import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, FORECLOSURE_TABLE } from '@/lib/supabase';

interface PhillipJonesLawData {
  SourceWebsite: string;
  CaseNumber: string;
  PropertyAddress: string;
  County: string;
  SaleDate: string;
  SaleTime: string;
  Status: string;
}

interface ClearReconData {
  SourceWebsite: string;
  TS_Number: string;
  PropertyAddress: string;
  SaleDate: string;
  CurrentBid: string;
}

type ApifyAuctionData = PhillipJonesLawData | ClearReconData;

export async function POST(request: NextRequest) {
  try {
    const { source } = await request.json();
    
    // Map source to actor ID
    const actorMapping: Record<string, string> = {
      'phillipjoneslaw': process.env.APIFY_ACTOR_ID_PJ!,
      'clearrecon': process.env.APIFY_ACTOR_ID_CLEARRECON!,
      // Add more mappings as we create more actors
    };

    const actorId = actorMapping[source];
    if (!actorId) {
      return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
    }

    const apiToken = process.env.APIFY_API_TOKEN;
    if (!apiToken) {
      return NextResponse.json({ error: 'Apify API token not configured' }, { status: 500 });
    }

    console.log(`Running Apify actor ${actorId} for source: ${source}`);

    // Step 1: Run the Apify actor
    // URL encode the actor ID to handle usernames with forward slashes
    const encodedActorId = encodeURIComponent(actorId);
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${encodedActorId}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...(source === 'phillipjoneslaw' ? {
            input: {
              url: 'https://phillipjoneslaw.com/foreclosure-auctions.cfm?accept=yes'
            }
          } : {})
        })
      }
    );

    if (!runResponse.ok) {
      const error = await runResponse.text();
      throw new Error(`Failed to run Apify actor: ${error}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    
    // Step 2: Wait for the run to complete and get the dataset
    const datasetId = runData.data.defaultDatasetId;
    console.log(`Actor run started with ID: ${runId}, dataset: ${datasetId}`);

    // Instead of checking run status, poll the dataset for data
    console.log(`Polling dataset for data...`);
    
    let apifyData: ApifyAuctionData[] = [];
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    
    while (apifyData.length === 0 && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
      
      console.log(`Dataset polling attempt ${attempts}/${maxAttempts}`);
      
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}&clean=true&format=json`
      );

      if (datasetResponse.ok) {
        const data = await datasetResponse.json();
        apifyData = data;
        console.log(`Dataset check ${attempts}: Found ${apifyData.length} records`);
      } else {
        console.log(`Dataset fetch failed on attempt ${attempts}`);
      }
    }
    
    if (apifyData.length === 0) {
      throw new Error(`No data found in dataset after ${maxAttempts} attempts`);
    }

    console.log(`Successfully retrieved ${apifyData.length} records from Apify`);
    
    // Debug: Log first record to see data structure
    if (apifyData.length > 0) {
      console.log(`First record structure:`, JSON.stringify(apifyData[0], null, 2));
    }

    if (apifyData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No data found',
        recordsProcessed: 0,
        recordsInserted: 0
      });
    }

    // Step 3: Clear existing data for this source
    const { error: deleteError } = await supabaseAdmin
      .from(FORECLOSURE_TABLE)
      .delete()
      .eq('source', source);

    if (deleteError) {
      console.error('Error clearing existing data:', deleteError);
    }

    // Step 4: Transform and insert data into Supabase
    const supabaseRecords = apifyData.map(record => {
      if (source === 'phillipjoneslaw') {
        const pjRecord = record as PhillipJonesLawData;
        return {
          source,
          date: pjRecord.SaleDate,
          time: pjRecord.SaleTime,
          county: extractCountyFromPJData(pjRecord.County),
          firm: 'Phillip Jones Law',
          address: cleanAddress(pjRecord.PropertyAddress),
          city: extractCityFromAddress(pjRecord.PropertyAddress),
          within_30min: 'N',
          closest_city: null,
          distance_miles: null,
          est_drive_time: null,
          geocode_method: null
        };
      } else if (source === 'clearrecon') {
        const crRecord = record as ClearReconData;
        return {
          source,
          date: crRecord.SaleDate,
          time: '00:00', // ClearRecon doesn't provide time
          county: extractCountyFromAddress(crRecord.PropertyAddress),
          firm: 'ClearRecon',
          address: cleanAddress(crRecord.PropertyAddress),
          city: extractCityFromAddress(crRecord.PropertyAddress),
          within_30min: 'N',
          closest_city: null,
          distance_miles: null,
          est_drive_time: null,
          geocode_method: null
        };
      }
      
      // Default fallback - should not happen but handle gracefully
      const fallbackRecord = record as any;
      return {
        source,
        date: fallbackRecord.SaleDate || '',
        time: '00:00',
        county: 'Unknown',
        firm: 'Unknown',
        address: cleanAddress(fallbackRecord.PropertyAddress || ''),
        city: extractCityFromAddress(fallbackRecord.PropertyAddress || ''),
        within_30min: 'N',
        closest_city: null,
        distance_miles: null,
        est_drive_time: null,
        geocode_method: null
      };
    });

    // Insert in batches
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < supabaseRecords.length; i += batchSize) {
      const batch = supabaseRecords.slice(i, i + batchSize);
      
      const { error: insertError } = await supabaseAdmin
        .from(FORECLOSURE_TABLE)
        .insert(batch);

      if (insertError) {
        console.error('Error inserting batch:', insertError);
        return NextResponse.json({
          error: 'Failed to insert data batch',
          details: insertError.message,
          batchNumber: Math.floor(i / batchSize) + 1
        }, { status: 500 });
      }

      totalInserted += batch.length;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully scraped ${source} data via Apify`,
      recordsProcessed: apifyData.length,
      recordsInserted: totalInserted,
      runId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Apify scraping error:', error);
    return NextResponse.json({
      error: 'Failed to run Apify scraper',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to convert text to proper case
function toProperCase(text: string): string {
  return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

// Helper function to clean and format full address
function cleanAddress(address: string): string {
  // Remove extra spaces and convert to proper case
  return toProperCase(address.replace(/\s+/g, ' ').trim());
}

// Helper function to extract city from address
function extractCityFromAddress(address: string): string {
  // Handle two formats:
  // ClearRecon: "467 Ball Play Road, Old Fort TN, 37362"
  // Phillip Jones: "1850 B G Fort Rd. Cedar Hill, Tn 37032"
  
  const parts = address.split(',');
  
  if (parts.length >= 3) {
    // ClearRecon format: "Street, City STATE, ZIP"
    const cityState = parts[parts.length - 2]?.trim() || '';
    const cityPart = cityState.replace(/\s+[A-Z]{2}$/, '').trim();
    return cityPart ? toProperCase(cityPart) : 'Unknown';
  } else if (parts.length === 2) {
    // Phillip Jones format: "Street City, STATE ZIP"
    const streetPart = parts[0]?.trim() || '';
    
    // Try to extract city from end of street part
    // Look for pattern: "NUMBER STREET_WORDS CITY_WORDS"
    // Split by spaces and take the last 1-2 words as potential city
    const words = streetPart.split(/\s+/);
    if (words.length >= 2) {
      // Try last 2 words first (for cities like "Cedar Hill")
      const lastTwoWords = words.slice(-2).join(' ');
      if (lastTwoWords.match(/^[A-Za-z\s]+$/)) {
        return toProperCase(lastTwoWords);
      }
      
      // Fallback to last word
      const lastWord = words[words.length - 1];
      if (lastWord.match(/^[A-Za-z]+$/)) {
        return toProperCase(lastWord);
      }
    }
  }
  
  return 'Unknown';
}

// Helper function to extract county from Phillip Jones Law data
function extractCountyFromPJData(countyField: string): string {
  // The County field from Phillip Jones Law contains county name
  return toProperCase(countyField.trim());
}

// Helper function to extract county from address (for ClearRecon)
function extractCountyFromAddress(address: string): string {
  // For ClearRecon, we need to map city to county or extract from other data
  // This is a simplified mapping - in reality you'd want a more comprehensive lookup
  const city = extractCityFromAddress(address).toLowerCase();
  
  // Tennessee county mapping (partial - add more as needed)
  const cityToCounty: Record<string, string> = {
    'nashville': 'Davidson',
    'memphis': 'Shelby',
    'knoxville': 'Knox',
    'chattanooga': 'Hamilton',
    'clarksville': 'Montgomery',
    'murfreesboro': 'Rutherford',
    'columbia': 'Maury',
    'franklin': 'Williamson',
    'hendersonville': 'Sumner',
    'spring hill': 'Maury',
    'old hickory': 'Davidson',
    'cedar hill': 'Robertson',
    'old fort': 'Polk',
    'piney flats': 'Sullivan',
    'kimball': 'Marion',
    'hartsville': 'Trousdale',
    'lynchburg': 'Moore',
    'lakeland': 'Shelby',
    'georgetown': 'Meigs',
    'dyersburg': 'Dyer'
  };
  
  return cityToCounty[city] || 'Unknown';
}
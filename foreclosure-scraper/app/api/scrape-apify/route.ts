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
          pl: pjRecord.County.charAt(0).toUpperCase(), // First letter of county
          firm: 'Phillip Jones Law',
          address: pjRecord.PropertyAddress,
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
          pl: extractStateFromAddress(crRecord.PropertyAddress), // Try to extract state
          firm: 'ClearRecon',
          address: crRecord.PropertyAddress,
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
        pl: 'TN',
        firm: 'Unknown',
        address: fallbackRecord.PropertyAddress || '',
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

// Helper function to extract city from address
function extractCityFromAddress(address: string): string {
  // Handle two formats:
  // ClearRecon: "467 Ball Play Road, Old Fort TN, 37362"
  // Phillip Jones: "1850 B G FORT RD. CEDAR HILL, TN 37032"
  
  const parts = address.split(',');
  
  if (parts.length >= 2) {
    const cityState = parts[parts.length - 2]?.trim() || '';
    // Remove state abbreviation (2 letters) from the end
    const cityPart = cityState.replace(/\s+[A-Z]{2}$/, '').trim();
    return cityPart || 'Unknown';
  }
  
  // Fallback: try to extract from single string format
  // Look for pattern: "...CITY, STATE ZIP" or "...CITY STATE ZIP"
  const match = address.match(/\b([A-Z\s]+)\s+[A-Z]{2}\s+\d{5}$/);
  if (match) {
    const cityPart = match[1].trim();
    // Remove common street suffixes that might be confused with city
    const cleanCity = cityPart.replace(/^(RD|ST|AVE|DR|BLVD|LN|CT|WAY|PL)\s+/, '');
    return cleanCity || 'Unknown';
  }
  
  return 'Unknown';
}

// Helper function to extract state from address
function extractStateFromAddress(address: string): string {
  // Try to extract state abbreviation from address
  const parts = address.split(',');
  if (parts.length >= 2) {
    const stateZip = parts[parts.length - 1]?.trim() || '';
    const stateMatch = stateZip.match(/\b([A-Z]{2})\b/);
    if (stateMatch) {
      return stateMatch[1];
    }
  }
  return 'TN'; // Default to Tennessee
}
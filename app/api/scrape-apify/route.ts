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

interface TnLedgerData {
  borrower_list: string;
  property_address_list: string;
  advertised_auction_date_list: string;
  date_of_first_notice_list: string;
  details_url: string;
  borrower_detail: string;
  address_detail: string;
  original_trustee: string;
  attorney: string;
  instrument_no: string;
  substitute_trustee: string;
  advertised_auction_date_detail: string;
  date_of_first_public_notice_detail: string;
  trust_date: string;
  tdn_no: string;
  sale_details_text: string;
  
  // Enhanced fields from updated actor
  auction_time?: string;
  auction_location?: string;
  auction_address?: string;
  property_lat?: number;
  property_lng?: number;
  property_formatted_address?: string;
  auction_lat?: number;
  auction_lng?: number;
  auction_formatted_address?: string;
  scraped_at?: string;
  notice_date?: string;
}

interface WabiPowerBiData {
  COUNTY_NAME: string;
  SALE_DATE: string;
  SALE_TIME: string;
  FULL_ADDRESS: string;
  BID_AMNT: string;
  SourceWebsite: string;
  scraped_at: string;
}

interface WilsonAssociatesData {
  SourceWebsite: string;
  SaleDate: string;
  SaleTime: string;
  PriorSaleDate: string;
  PropertyAddress: string;
  City: string;
  County: string;
  State: string;
  ZipCode: string;
  SaleLocation: string;
  Auctioneer: string;
  scraped_at: string;
}

interface ConnectedInvestorsData {
  searchAddress: string;
  address?: string;
  price?: string;
  beds?: string;
  baths?: string;
  sqft?: string;
  lot_size?: string;
  year_built?: string;
  property_type?: string;
  scraped_at: string;
  skipTrace?: {
    attempted_at: string;
    method: string;
    results: {
      emails?: string[];
      phones?: string[];
      owner_info?: string;
      detail_owner_info?: any;
    };
  };
  links?: Array<{
    url: string;
    text: string;
  }>;
  extraction_method?: string;
  raw_text?: string;
}

type ApifyAuctionData = PhillipJonesLawData | ClearReconData | TnLedgerData | WabiPowerBiData | WilsonAssociatesData | ConnectedInvestorsData;

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }
    
    const { source } = await request.json();
    
    // Map source to actor ID
    const actorMapping: Record<string, string> = {
      'phillipjoneslaw': process.env.APIFY_ACTOR_ID_PJ!,
      'clearrecon': process.env.APIFY_ACTOR_ID_CLEARRECON!,
      'tnledger': process.env.APIFY_ACTOR_ID_TNLEDGER!,
      'wabipowerbi': process.env.APIFY_ACTOR_ID_WABIPOWERBI!,
      'wilsonassociates': process.env.APIFY_ACTOR_ID_WILSONASSOCIATES!,
      'connectedinvestors': process.env.APIFY_ACTOR_ID_CONNECTEDINVESTORS!,
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
          } : source === 'tnledger' ? {
            input: {
              noticesDate: new Date().toLocaleDateString('en-US')
              // Don't pass Supabase config - we'll handle data insertion in the API
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
    const supabaseRecords = await Promise.all(apifyData.map(async record => {
      if (source === 'phillipjoneslaw') {
        const pjRecord = record as PhillipJonesLawData;
        const county = extractCountyFromPJData(pjRecord.County);
        return {
          source,
          date: pjRecord.SaleDate,
          time: pjRecord.SaleTime,
          county,
          firm: 'Phillip Jones Law',
          address: cleanAddress(pjRecord.PropertyAddress),
          city: extractCityFromAddress(pjRecord.PropertyAddress),
          within_30min: isWithin30Minutes(county),
          closest_city: null,
          distance_miles: null,
          est_drive_time: null,
          geocode_method: null
        };
      } else if (source === 'clearrecon') {
        const crRecord = record as ClearReconData;
        const county = await extractCountyFromAddress(crRecord.PropertyAddress);
        return {
          source,
          date: crRecord.SaleDate,
          time: '00:00', // ClearRecon doesn't provide time
          county,
          firm: 'ClearRecon',
          address: cleanAddress(crRecord.PropertyAddress),
          city: extractCityFromAddress(crRecord.PropertyAddress),
          within_30min: isWithin30Minutes(county),
          closest_city: null,
          distance_miles: null,
          est_drive_time: null,
          geocode_method: 'google_maps'
        };
      } else if (source === 'tnledger') {
        const tnRecord = record as TnLedgerData;
        // Use the more detailed address if available, otherwise fall back to list address
        const address = tnRecord.address_detail && tnRecord.address_detail !== 'Not found' 
          ? tnRecord.address_detail 
          : tnRecord.property_address_list;
        
        // Extract county from address (since the actor doesn't do Supabase integration anymore)
        const county = await extractCountyFromAddress(address);
        
        return {
          source,
          date: tnRecord.advertised_auction_date_detail || tnRecord.advertised_auction_date_list,
          time: parseTimeString(tnRecord.auction_time) || '00:00:00', // Parse time format
          county,
          firm: 'TN Ledger',
          address: cleanAddress(address),
          city: extractCityFromAddress(address),
          within_30min: isWithin30Minutes(county),
          closest_city: null,
          distance_miles: null,
          est_drive_time: null,
          geocode_method: 'google_maps'
        };
      } else if (source === 'wabipowerbi') {
        const wabiRecord = record as WabiPowerBiData;
        // Extract county from address (since WABI PowerBI has county in COUNTY_NAME field)
        const county = wabiRecord.COUNTY_NAME || 'Unknown';
        
        return {
          source,
          date: parseDateString(wabiRecord.SALE_DATE) || wabiRecord.SALE_DATE,
          time: parseTimeString(wabiRecord.SALE_TIME) || '00:00:00',
          county,
          firm: 'Logs.com',
          address: cleanAddress(wabiRecord.FULL_ADDRESS),
          city: extractCityFromAddress(wabiRecord.FULL_ADDRESS),
          within_30min: isWithin30Minutes(county),
          closest_city: null,
          distance_miles: null,
          est_drive_time: null,
          geocode_method: 'google_maps'
        };
      } else if (source === 'wilsonassociates') {
        const wilsonRecord = record as WilsonAssociatesData;
        
        return {
          source,
          date: parseDateString(wilsonRecord.SaleDate) || wilsonRecord.SaleDate,
          time: parseTimeString(wilsonRecord.SaleTime) || '00:00:00',
          county: wilsonRecord.County || 'Unknown',
          firm: wilsonRecord.Auctioneer || 'Wilson Associates',
          address: cleanAddress(wilsonRecord.PropertyAddress),
          city: wilsonRecord.City || extractCityFromAddress(wilsonRecord.PropertyAddress),
          within_30min: isWithin30Minutes(wilsonRecord.County || 'Unknown'),
          closest_city: null,
          distance_miles: null,
          est_drive_time: null,
          geocode_method: 'google_maps'
        };
      } else if (source === 'connectedinvestors') {
        const ciRecord = record as ConnectedInvestorsData;
        
        // For Connected Investors, we're not dealing with foreclosure auctions but investment properties
        // We'll adapt the data to fit our schema while preserving unique skip trace information
        const address = ciRecord.address || ciRecord.searchAddress;
        const county = await extractCountyFromAddress(address);
        
        return {
          source,
          date: new Date().toISOString().split('T')[0], // Current date since these are listings, not auctions
          time: '00:00:00',
          county,
          firm: 'Connected Investors',
          address: cleanAddress(address),
          city: extractCityFromAddress(address),
          within_30min: isWithin30Minutes(county),
          closest_city: null,
          distance_miles: null,
          est_drive_time: null,
          geocode_method: 'google_maps',
          // Additional Connected Investors specific fields
          property_details: {
            price: ciRecord.price,
            beds: ciRecord.beds,
            baths: ciRecord.baths,
            sqft: ciRecord.sqft,
            lot_size: ciRecord.lot_size,
            year_built: ciRecord.year_built,
            property_type: ciRecord.property_type
          },
          skip_trace: ciRecord.skipTrace,
          owner_emails: ciRecord.skipTrace?.results?.emails?.join(', ') || null,
          owner_phones: ciRecord.skipTrace?.results?.phones?.join(', ') || null,
          owner_info: ciRecord.skipTrace?.results?.owner_info || null
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
        within_30min: isWithin30Minutes(fallbackRecord.county || 'Unknown'),
        closest_city: null,
        distance_miles: null,
        est_drive_time: null,
        geocode_method: null
      };
    }));

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

// Helper function to clean and parse date strings from WABI PowerBI
function parseDateString(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  
  try {
    // Clean the date string by removing postponement text and extra info
    let cleanDate = dateStr.trim();
    
    // Handle cases like "07/24/25 Postponed Until 10/02" - take the original date
    const postponedMatch = cleanDate.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+postponed/i);
    if (postponedMatch) {
      cleanDate = postponedMatch[1];
    }
    
    // Handle cases with extra text after the date
    const dateMatch = cleanDate.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (dateMatch) {
      cleanDate = dateMatch[1];
    }
    
    // Convert 2-digit year to 4-digit year if needed
    const parts = cleanDate.split('/');
    if (parts.length === 3 && parts[2].length === 2) {
      const year = parseInt(parts[2]);
      // Assume years 00-30 are 2000s, 31-99 are 1900s
      parts[2] = year <= 30 ? `20${parts[2]}` : `19${parts[2]}`;
      cleanDate = parts.join('/');
    }
    
    // Parse the date and return in MM/DD/YYYY format
    const date = new Date(cleanDate);
    if (isNaN(date.getTime())) {
      console.warn(`Could not parse date: ${dateStr}`);
      return null;
    }
    
    return (date.getMonth() + 1).toString().padStart(2, '0') + '/' + 
           date.getDate().toString().padStart(2, '0') + '/' + 
           date.getFullYear();
  } catch (error) {
    console.error('Error parsing date string:', dateStr, error);
    return null;
  }
}

// Helper function to parse time strings like "11:00 AM" to "11:00:00" format
function parseTimeString(timeStr: string | undefined): string | null {
  if (!timeStr) return null;
  
  try {
    // Handle formats like "11:00 AM", "2:00 P.M.", "10:00 A.M.", etc.
    const cleanTime = timeStr.trim().replace(/\./g, '').toUpperCase();
    const match = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    
    if (!match) return null;
    
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const ampm = match[3];
    
    // Convert to 24-hour format
    if (ampm === 'PM' && hours !== 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }
    
    // Format as HH:MM:SS
    return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
  } catch (error) {
    console.error('Error parsing time string:', timeStr, error);
    return null;
  }
}

// Helper function to check if property is within 30 minutes based on county
function isWithin30Minutes(county: string): 'Y' | 'N' {
  const targetCounties = ['Davidson', 'Wilson', 'Sumner'];
  return targetCounties.includes(county) ? 'Y' : 'N';
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

// Helper function to extract county from address using Google Maps Geocoding API
async function extractCountyFromAddress(address: string): Promise<string> {
  // First try the fallback mapping for common cases to avoid API calls
  const city = extractCityFromAddress(address).toLowerCase();
  
  // Common Tennessee cities mapping for performance
  const commonCityToCounty: Record<string, string> = {
    'nashville': 'Davidson',
    'memphis': 'Shelby',
    'knoxville': 'Knox',
    'chattanooga': 'Hamilton',
    'clarksville': 'Montgomery',
    'murfreesboro': 'Rutherford'
  };
  
  if (commonCityToCounty[city]) {
    console.log(`Using cached county for ${city}: ${commonCityToCounty[city]}`);
    return commonCityToCounty[city];
  }
  
  // Use Google Maps Geocoding API for less common cities
  console.log(`Attempting to geocode address: ${address} (extracted city: ${city})`);
  try {
    const county = await geocodeAddressForCounty(address);
    if (county) {
      console.log(`Geocoded county for ${address}: ${county}`);
      return county;
    } else {
      console.log(`No county found via geocoding for ${address}`);
      return 'Unknown';
    }
  } catch (error) {
    console.error('Geocoding failed for address:', address, error);
    return 'Unknown';
  }
}

// Helper function to extract county from coordinates using reverse geocoding
async function extractCountyFromCoordinates(lat: number, lng: number): Promise<string> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY not configured, falling back to Unknown county');
    return 'Unknown';
  }
  
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    
    console.log(`Making reverse geocoding request for coordinates: ${lat}, ${lng}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Reverse geocoding API HTTP error: ${response.status} ${response.statusText}`);
      return 'Unknown';
    }
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      
      // Look for the county in the address components
      const countyComponent = result.address_components.find((component: any) => 
        component.types.includes('administrative_area_level_2')
      );
      
      if (countyComponent) {
        // Remove " County" suffix if present
        let county = countyComponent.long_name;
        if (county.endsWith(' County')) {
          county = county.replace(' County', '');
        }
        console.log(`Found county from coordinates: ${county}`);
        return county;
      }
    }
    
    return 'Unknown';
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return 'Unknown';
  }
}

// Google Maps Geocoding API helper function
async function geocodeAddressForCounty(address: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY not configured, falling back to Unknown county');
    return null;
  }
  
  try {
    // Clean and format the address for geocoding
    const cleanAddress = `${address}, Tennessee, USA`;
    const encodedAddress = encodeURIComponent(cleanAddress);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
    
    console.log(`Making geocoding request to: ${url.replace(apiKey, '***')}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Geocoding API HTTP error: ${response.status} ${response.statusText}`);
      throw new Error(`Geocoding API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Geocoding response status: ${data.status}`);
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      console.log(`Geocoding result components:`, result.address_components?.map((c: any) => `${c.long_name} (${c.types.join(', ')})`));
      
      // Look for the county in the address components
      const countyComponent = result.address_components.find((component: any) => 
        component.types.includes('administrative_area_level_2')
      );
      
      if (countyComponent) {
        // Remove " County" suffix if present
        let county = countyComponent.long_name;
        if (county.endsWith(' County')) {
          county = county.replace(' County', '');
        }
        console.log(`Found county: ${county}`);
        return county;
      } else {
        console.log('No administrative_area_level_2 found in address components');
      }
    } else {
      console.error(`Geocoding API error: ${data.status} - ${data.error_message || 'No error message'}`);
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
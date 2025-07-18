import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { FeatureFlags } from '../../../lib/config';
import type { Property, DistressEvent } from '../../../lib/supabase';

// Import the same interfaces from the legacy scraper
interface ScraperData {
  address: string;
  city?: string;
  county?: string;
  state?: string;
  date: string;
  time?: string;
  firm?: string;
  source: string;
  [key: string]: any;
}

interface PropertyUpdateInfo {
  property: Property;
  isNew: boolean;
  saleDateChanged: boolean;
  oldSaleDate?: string;
  newSaleDate?: string;
}

// County center coordinates for distance calculations
const COUNTY_CENTERS = {
  Davidson: { lat: 36.1627, lng: -86.7816 },
  Sumner: { lat: 36.4667, lng: -86.4667 },
  Wilson: { lat: 36.1542, lng: -86.2967 }
};

const TARGET_COUNTIES = ['Davidson', 'Sumner', 'Wilson'];

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

    console.log(`🚀 Running vNext Apify scraper for source: ${source}`);

    // Step 1: Run the Apify actor (same as legacy)
    const encodedActorId = encodeURIComponent(actorId);
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${encodedActorId}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...(source === 'phillipjoneslaw' ? {
            input: { url: 'https://phillipjoneslaw.com/foreclosure-auctions.cfm?accept=yes' }
          } : source === 'tnledger' ? {
            input: { noticesDate: new Date().toLocaleDateString('en-US') }
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
    const datasetId = runData.data.defaultDatasetId;
    
    console.log(`📊 Actor run started with ID: ${runId}, dataset: ${datasetId}`);

    // Step 2: Poll for data
    let apifyData: any[] = [];
    let attempts = 0;
    const maxAttempts = 60;
    
    while (apifyData.length === 0 && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
      
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}&clean=true&format=json`
      );

      if (datasetResponse.ok) {
        const data = await datasetResponse.json();
        apifyData = data;
        console.log(`📊 Dataset check ${attempts}: Found ${apifyData.length} records`);
      }
    }
    
    if (apifyData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No data found',
        stats: { newProperties: 0, updatedProperties: 0, totalRecords: 0 }
      });
    }

    console.log(`✅ Successfully retrieved ${apifyData.length} records from Apify`);

    // Step 3: Process data with duplicate detection and status tracking
    const results = await processScrapedData(apifyData, source);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${source} data`,
      stats: results.stats,
      runId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('vNext scraping error:', error);
    return NextResponse.json({
      error: 'Failed to run vNext scraper',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function processScrapedData(records: any[], source: string) {
  const stats = {
    totalRecords: records.length,
    newProperties: 0,
    updatedProperties: 0,
    saleDateChanges: 0,
    duplicates: 0,
    errors: 0
  };

  // First, get all existing properties to check for duplicates
  const addresses = records.map(r => normalizeAddress(extractAddress(r, source)));
  const { data: existingProperties } = await supabaseAdmin!
    .from('properties')
    .select('*')
    .in('full_address', addresses);

  const existingMap = new Map(
    existingProperties?.map(p => [normalizeAddress(p.full_address), p]) || []
  );

  // Process each record
  for (const record of records) {
    try {
      const propertyData = transformToPropertyData(record, source);
      const normalizedAddress = normalizeAddress(propertyData.address);
      const existingProperty = existingMap.get(normalizedAddress);

      if (existingProperty) {
        // Property exists - check for updates
        const updateResult = await handleExistingProperty(
          existingProperty, 
          propertyData,
          source
        );

        if (updateResult.saleDateChanged) {
          stats.saleDateChanges++;
          stats.updatedProperties++;
        } else {
          stats.duplicates++;
        }
      } else {
        // New property
        await createNewProperty(propertyData, source);
        stats.newProperties++;
      }
    } catch (error) {
      console.error('Error processing record:', error);
      stats.errors++;
    }
  }

  console.log('📊 Processing complete:', stats);
  return { stats };
}

async function handleExistingProperty(
  existing: Property,
  newData: any,
  source: string
): Promise<{ saleDateChanged: boolean }> {
  let saleDateChanged = false;

  // Get the latest distress event for this property
  const { data: latestEvent } = await supabaseAdmin!
    .from('distress_events')
    .select('*')
    .eq('property_id', existing.id)
    .eq('source', source)
    .order('event_date', { ascending: false })
    .limit(1)
    .single();

  // Check if sale date has changed
  if (latestEvent && latestEvent.event_date !== newData.date) {
    saleDateChanged = true;

    // Create new distress event with updated date
    await supabaseAdmin!
      .from('distress_events')
      .insert({
        property_id: existing.id,
        event_date: newData.date,
        event_time: newData.time,
        event_type: 'FORECLOSURE',
        source: source,
        firm: newData.firm,
        metadata: {
          previous_date: latestEvent.event_date,
          date_changed: true
        }
      });

    // Update property status and tracking
    await supabaseAdmin!
      .from('properties')
      .update({
        status: 'updated',
        last_seen_at: new Date().toISOString(),
        sale_date_updated_count: (existing.sale_date_updated_count || 0) + 1
      })
      .eq('id', existing.id);

    // Log to property history
    await supabaseAdmin!
      .from('property_history')
      .insert({
        property_id: existing.id,
        change_type: 'sale_date_changed',
        old_value: { sale_date: latestEvent.event_date },
        new_value: { sale_date: newData.date },
        changed_by: `scraper_${source}`
      });
  } else {
    // Just update last_seen_at
    await supabaseAdmin!
      .from('properties')
      .update({
        last_seen_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  }

  return { saleDateChanged };
}

async function createNewProperty(data: any, source: string): Promise<string> {
  // Calculate distances to target counties
  const distances = await calculateCountyDistances(data.county);
  
  // Create the property
  const { data: property, error } = await supabaseAdmin!
    .from('properties')
    .insert({
      full_address: data.address,
      street: data.street || data.address,
      city: data.city,
      state: 'TN',
      county: data.county,
      property_type: data.property_type || 'Unknown',
      status: 'new',
      is_in_target_counties: TARGET_COUNTIES.includes(data.county),
      ...distances,
      // Nashville and Mt Juliet proximity (for backward compatibility)
      within_30min_nash: distances.distance_to_davidson_mi <= 30,
      within_30min_mtjuliet: distances.distance_to_wilson_mi <= 30,
      distance_nash_mi: distances.distance_to_davidson_mi,
      distance_mtjuliet_mi: distances.distance_to_wilson_mi
    })
    .select()
    .single();

  if (error) throw error;

  // Create the distress event
  await supabaseAdmin!
    .from('distress_events')
    .insert({
      property_id: property.id,
      event_date: data.date,
      event_time: data.time || '00:00:00',
      event_type: 'FORECLOSURE',
      source: source,
      firm: data.firm
    });

  // Log to property history
  await supabaseAdmin!
    .from('property_history')
    .insert({
      property_id: property.id,
      change_type: 'created',
      new_value: { source, initial_sale_date: data.date },
      changed_by: `scraper_${source}`
    });

  return property.id;
}

// Helper functions
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .trim();
}

function extractAddress(record: any, source: string): string {
  switch (source) {
    case 'phillipjoneslaw':
      return record.PropertyAddress;
    case 'clearrecon':
      return record.PropertyAddress;
    case 'tnledger':
      return record.address_detail || record.property_address_list;
    case 'wabipowerbi':
      return record.FULL_ADDRESS;
    case 'wilsonassociates':
      return record.PropertyAddress;
    case 'connectedinvestors':
      return record.address || record.searchAddress;
    default:
      return record.PropertyAddress || record.address || '';
  }
}

function transformToPropertyData(record: any, source: string): any {
  // Transform based on source type
  const baseData = {
    source,
    date: extractDate(record, source),
    time: extractTime(record, source),
    county: extractCounty(record, source),
    firm: extractFirm(record, source),
    address: extractAddress(record, source),
    city: extractCity(record, source),
  };

  return baseData;
}

function extractDate(record: any, source: string): string {
  switch (source) {
    case 'phillipjoneslaw':
      return record.SaleDate;
    case 'clearrecon':
      return record.SaleDate;
    case 'tnledger':
      return record.advertised_auction_date_detail || record.advertised_auction_date_list;
    case 'wabipowerbi':
      return parseDateString(record.SALE_DATE) || record.SALE_DATE;
    case 'wilsonassociates':
      return parseDateString(record.SaleDate) || record.SaleDate;
    case 'connectedinvestors':
      return new Date().toISOString().split('T')[0];
    default:
      return record.SaleDate || record.date || '';
  }
}

function extractTime(record: any, source: string): string {
  switch (source) {
    case 'phillipjoneslaw':
      return record.SaleTime || '00:00:00';
    case 'clearrecon':
      return '00:00:00';
    case 'tnledger':
      return parseTimeString(record.auction_time) || '00:00:00';
    case 'wabipowerbi':
      return parseTimeString(record.SALE_TIME) || '00:00:00';
    case 'wilsonassociates':
      return parseTimeString(record.SaleTime) || '00:00:00';
    default:
      return '00:00:00';
  }
}

function extractCounty(record: any, source: string): string {
  switch (source) {
    case 'phillipjoneslaw':
      return toProperCase(record.County);
    case 'wabipowerbi':
      return record.COUNTY_NAME || 'Unknown';
    case 'wilsonassociates':
      return record.County || 'Unknown';
    default:
      // For others, extract from address or use Unknown
      return extractCountyFromAddressSync(extractAddress(record, source));
  }
}

function extractCity(record: any, source: string): string {
  switch (source) {
    case 'wilsonassociates':
      return record.City || extractCityFromAddress(record.PropertyAddress);
    default:
      return extractCityFromAddress(extractAddress(record, source));
  }
}

function extractFirm(record: any, source: string): string {
  const firmMap: Record<string, string> = {
    'phillipjoneslaw': 'Phillip Jones Law',
    'clearrecon': 'ClearRecon',
    'tnledger': 'TN Ledger',
    'wabipowerbi': 'Logs.com',
    'wilsonassociates': 'Wilson Associates',
    'connectedinvestors': 'Connected Investors'
  };
  
  return record.Auctioneer || firmMap[source] || source;
}

// Calculate distances from property county to target counties
async function calculateCountyDistances(propertyCounty: string) {
  const distances: any = {};
  
  // If property is in a target county, distance is 0
  for (const targetCounty of Object.keys(COUNTY_CENTERS)) {
    if (propertyCounty === targetCounty) {
      distances[`distance_to_${targetCounty.toLowerCase()}_mi`] = 0;
    } else {
      // For now, use a simple estimation (will be replaced with actual geocoding)
      distances[`distance_to_${targetCounty.toLowerCase()}_mi`] = 50; // Default
    }
  }

  // Find nearest target county
  const countyDistances = Object.entries(distances)
    .filter(([key]) => key.startsWith('distance_to_'))
    .map(([key, value]) => ({
      county: key.replace('distance_to_', '').replace('_mi', ''),
      distance: value as number
    }))
    .sort((a, b) => a.distance - b.distance);

  if (countyDistances.length > 0) {
    distances.nearest_target_county = toProperCase(countyDistances[0].county);
    distances.nearest_target_distance_mi = countyDistances[0].distance;
  }

  return distances;
}

// Utility functions (reuse from legacy scraper)
function toProperCase(text: string): string {
  return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseDateString(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  
  try {
    let cleanDate = dateStr.trim();
    const postponedMatch = cleanDate.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+postponed/i);
    if (postponedMatch) {
      cleanDate = postponedMatch[1];
    }
    
    const dateMatch = cleanDate.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (dateMatch) {
      cleanDate = dateMatch[1];
    }
    
    const parts = cleanDate.split('/');
    if (parts.length === 3 && parts[2].length === 2) {
      const year = parseInt(parts[2]);
      parts[2] = year <= 30 ? `20${parts[2]}` : `19${parts[2]}`;
      cleanDate = parts.join('/');
    }
    
    const date = new Date(cleanDate);
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return (date.getMonth() + 1).toString().padStart(2, '0') + '/' + 
           date.getDate().toString().padStart(2, '0') + '/' + 
           date.getFullYear();
  } catch (error) {
    return null;
  }
}

function parseTimeString(timeStr: string | undefined): string | null {
  if (!timeStr) return null;
  
  try {
    const cleanTime = timeStr.trim().replace(/\./g, '').toUpperCase();
    const match = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    
    if (!match) return null;
    
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const ampm = match[3];
    
    if (ampm === 'PM' && hours !== 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
  } catch (error) {
    return null;
  }
}

function extractCityFromAddress(address: string): string {
  const parts = address.split(',');
  
  if (parts.length >= 3) {
    const cityState = parts[parts.length - 2]?.trim() || '';
    const cityPart = cityState.replace(/\s+[A-Z]{2}$/, '').trim();
    return cityPart ? toProperCase(cityPart) : 'Unknown';
  } else if (parts.length === 2) {
    const streetPart = parts[0]?.trim() || '';
    const words = streetPart.split(/\s+/);
    if (words.length >= 2) {
      const lastTwoWords = words.slice(-2).join(' ');
      if (lastTwoWords.match(/^[A-Za-z\s]+$/)) {
        return toProperCase(lastTwoWords);
      }
      
      const lastWord = words[words.length - 1];
      if (lastWord.match(/^[A-Za-z]+$/)) {
        return toProperCase(lastWord);
      }
    }
  }
  
  return 'Unknown';
}

function extractCountyFromAddressSync(address: string): string {
  const city = extractCityFromAddress(address).toLowerCase();
  
  const commonCityToCounty: Record<string, string> = {
    'nashville': 'Davidson',
    'memphis': 'Shelby',
    'knoxville': 'Knox',
    'chattanooga': 'Hamilton',
    'clarksville': 'Montgomery',
    'murfreesboro': 'Rutherford',
    'franklin': 'Williamson',
    'brentwood': 'Williamson',
    'hendersonville': 'Sumner',
    'gallatin': 'Sumner',
    'lebanon': 'Wilson',
    'mt juliet': 'Wilson',
    'mount juliet': 'Wilson'
  };
  
  return commonCityToCounty[city] || 'Unknown';
}
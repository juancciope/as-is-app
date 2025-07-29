import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, FORECLOSURE_TABLE, ForeclosureData } from '../../../lib/supabase';
import { FeatureFlags, DatabaseConfig } from '../../../lib/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const dbClient = supabaseAdmin || supabase;
    if (!dbClient) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    
    // Check feature flag to determine which table to use
    if (FeatureFlags.USE_LEGACY) {
      return await handleLegacyDataRequest(dbClient, searchParams);
    } else {
      return await handleVNextDataRequest(dbClient, searchParams);
    }
    
  } catch (error) {
    console.error('Data fetch error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch data', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle data request using legacy foreclosure_data table
 */
async function handleLegacyDataRequest(dbClient: any, searchParams: URLSearchParams) {
  // Build the query
  let query = dbClient.from(FORECLOSURE_TABLE).select('*');
    
  // Apply filters
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const counties = searchParams.get('counties');
  const sources = searchParams.get('sources');
  const within30min = searchParams.get('within30min');
  const enrichmentStatus = searchParams.get('enrichmentStatus');
  
  // Date range filter
  if (dateFrom) {
    query = query.gte('date', dateFrom);
  }
  
  if (dateTo) {
    query = query.lte('date', dateTo);
  }
  
  // Counties filter (comma-separated list)
  if (counties && counties !== '') {
    const countyList = counties.split(',').map(c => c.trim()).filter(c => c.length > 0);
    if (countyList.length > 0) {
      query = query.in('county', countyList);
    }
  }
  
  // Sources filter (comma-separated list)
  if (sources && sources !== '') {
    const sourceList = sources.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (sourceList.length > 0) {
      query = query.in('source', sourceList);
    }
  }
  
  // Within 30 minutes filter
  if (within30min === 'true') {
    query = query.eq('within_30min', 'Y');
  }
  
  // Enrichment status filter
  if (enrichmentStatus === 'enriched') {
    query = query.or('owner_email_1.not.is.null,owner_phone_1.not.is.null');
  } else if (enrichmentStatus === 'needs_enrichment') {
    query = query.is('owner_email_1', null).is('owner_phone_1', null);
  }
  
  // Order by date descending
  query = query.order('date', { ascending: false });
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Supabase query error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch data from database', 
        details: error.message
      },
      { status: 500 }
    );
  }
  
  return NextResponse.json({
    data: data || [],
    total: data?.length || 0,
    lastUpdated: new Date().toISOString()
  });
}

/**
 * Handle data request using vNext normalized schema
 */
async function handleVNextDataRequest(dbClient: any, searchParams: URLSearchParams) {
  // Build query for vNext properties with related data
  let query = dbClient
    .from('properties')
    .select(`
      id,
      full_address,
      street,
      city,
      state,
      county,
      status,
      is_in_target_counties,
      distance_to_davidson_mi,
      distance_to_sumner_mi,
      distance_to_wilson_mi,
      nearest_target_county,
      nearest_target_distance_mi,
      within_30min_nash,
      within_30min_mtjuliet,
      distance_nash_mi,
      distance_mtjuliet_mi,
      property_type,
      created_at,
      updated_at,
      first_seen_at,
      sale_date_updated_count,
      distress_events!inner (
        event_date,
        event_time,
        source,
        firm,
        event_type,
        sale_date
      ),
      property_contacts (
        contacts (
          emails,
          phones
        )
      ),
      lead_pipeline (
        stage
      )
    `);
  
  // Apply filters
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const counties = searchParams.get('counties');
  const sources = searchParams.get('sources');
  const within30min = searchParams.get('within30min');
  const enrichmentStatus = searchParams.get('enrichmentStatus');
  
  // vNext specific filters
  const targetCounties = searchParams.get('targetCounties');
  const maxDistanceMiles = searchParams.get('maxDistanceMiles');
  const saleDateFrom = searchParams.get('saleDateFrom');
  const saleDateTo = searchParams.get('saleDateTo');
  const createdDateFrom = searchParams.get('createdDateFrom');
  const createdDateTo = searchParams.get('createdDateTo');
  
  // Date range filter (filter by distress event date)
  if (dateFrom || dateTo) {
    // For date filtering, we need to filter on the distress_events
    if (dateFrom) {
      query = query.filter('distress_events.event_date', 'gte', dateFrom);
    }
    if (dateTo) {
      query = query.filter('distress_events.event_date', 'lte', dateTo);
    }
  }
  
  // Counties filter
  if (counties && counties !== '') {
    const countyList = counties.split(',').map(c => c.trim()).filter(c => c.length > 0);
    if (countyList.length > 0) {
      query = query.in('county', countyList);
    }
  }
  
  // Sources filter (filter by distress event source)
  if (sources && sources !== '') {
    const sourceList = sources.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (sourceList.length > 0) {
      query = query.filter('distress_events.source', 'in', `(${sourceList.join(',')})`);
    }
  }
  
  // Within 30 minutes filter (combine both hubs)
  if (within30min === 'true') {
    query = query.or('within_30min_nash.eq.true,within_30min_mtjuliet.eq.true');
  }
  
  // Target counties and distance filter
  if (targetCounties && targetCounties !== '') {
    const countyList = targetCounties.split(',').map(c => c.trim()).filter(c => c.length > 0);
    const maxDistance = maxDistanceMiles ? parseFloat(maxDistanceMiles) : 30;
    
    if (countyList.length > 0) {
      // For now, fallback to simple county matching until distance data is populated
      // TODO: Implement proper distance calculation
      query = query.in('county', countyList);
    }
  }
  
  // Sale date filters (filter by distress event sale date)
  if (saleDateFrom || saleDateTo) {
    if (saleDateFrom) {
      query = query.filter('distress_events.sale_date', 'gte', saleDateFrom);
    }
    if (saleDateTo) {
      query = query.filter('distress_events.sale_date', 'lte', saleDateTo);
    }
  }
  
  // Created date filters (filter by property creation date)
  if (createdDateFrom || createdDateTo) {
    if (createdDateFrom) {
      query = query.gte('created_at', createdDateFrom);
    }
    if (createdDateTo) {
      // Add end of day to include the entire day
      const endOfDay = new Date(createdDateTo);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endOfDay.toISOString());
    }
  }
  
  // Order by creation date descending
  query = query.order('created_at', { ascending: false });
  
  const { data, error } = await query;
  
  if (error) {
    console.error('vNext query error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch vNext data', 
        details: error.message
      },
      { status: 500 }
    );
  }
  
  // Transform vNext data to legacy format for frontend compatibility
  const transformedData = (data || []).map((property: any) => {
    const distressEvent = property.distress_events?.[0]; // Get first distress event
    const hasContact = property.property_contacts?.some((pc: any) => 
      pc.contacts?.emails?.length > 0 || pc.contacts?.phones?.length > 0
    );
    
    return {
      id: property.id,
      address: property.full_address,
      city: property.city,
      county: property.county,
      date: distressEvent?.event_date || '',
      time: distressEvent?.event_time || '',
      source: distressEvent?.source || '',
      firm: distressEvent?.firm || '',
      within_30min: (property.within_30min_nash || property.within_30min_mtjuliet) ? 'Y' : 'N',
      distance_miles: property.nearest_target_distance_mi || property.distance_nash_mi || property.distance_mtjuliet_mi || null,
      created_at: property.created_at,
      updated_at: property.updated_at,
      
      // vNext status tracking
      status: property.status || 'new',
      is_in_target_counties: property.is_in_target_counties || false,
      first_seen_at: property.first_seen_at,
      sale_date_updated_count: property.sale_date_updated_count || 0,
      nearest_target_county: property.nearest_target_county,
      
      // County distances for advanced filtering
      distance_to_davidson_mi: property.distance_to_davidson_mi,
      distance_to_sumner_mi: property.distance_to_sumner_mi,
      distance_to_wilson_mi: property.distance_to_wilson_mi,
      
      // Add enrichment status for compatibility
      owner_email_1: hasContact ? 'enriched' : null,
      owner_phone_1: hasContact ? 'enriched' : null,
      // Add stage info
      stage: property.lead_pipeline?.[0]?.stage || 'new'
    };
  });
  
  return NextResponse.json({
    data: transformedData,
    total: transformedData.length,
    lastUpdated: new Date().toISOString(),
    dataSource: 'vnext'
  });
}
/**
 * vNext Properties API Endpoint
 * 
 * This endpoint provides enhanced property data access with:
 * - Normalized schema support (properties + distress_events + contacts)
 * - Advanced filtering capabilities
 * - Integrated scoring system
 * - Feature flag support for gradual rollout
 * - Pagination and sorting
 * - Performance optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { scoreProperties, createDefaultScorer } from '@/lib/scoring';
import { FeatureFlags, DatabaseConfig, VNextConfig } from '@/lib/config';
import type { 
  Property, 
  DistressEvent, 
  Contact, 
  PropertyContact, 
  LeadPipeline, 
  InvestorRules,
  PropertyWithEvents 
} from '@/lib/supabase';

interface PropertiesResponse {
  properties: EnhancedProperty[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: {
    applied: Record<string, any>;
    available: FilterOptions;
  };
  metadata: {
    scoringEnabled: boolean;
    dataSource: 'legacy' | 'vnext';
    lastUpdated: string;
  };
}

interface EnhancedProperty extends Property {
  // Event information
  next_sale_date?: string;
  event_count: number;
  events?: DistressEvent[];
  
  // Contact information
  enriched: boolean;
  contact_count: number;
  contacts?: Contact[];
  
  // Pipeline information
  stage?: string;
  
  // Scoring information
  score?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  urgency_days?: number;
  
  // Computed fields
  days_since_created: number;
  is_recent: boolean;
}

interface FilterOptions {
  counties: string[];
  sources: string[];
  stages: string[];
  priorities: string[];
  eventTypes: string[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    
    // Check feature flag to determine which implementation to use
    if (FeatureFlags.USE_LEGACY) {
      return await handleLegacyRequest(searchParams);
    } else {
      return await handleVNextRequest(searchParams);
    }

  } catch (error) {
    console.error('Properties API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch properties',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle request using legacy foreclosure_data table
 */
async function handleLegacyRequest(searchParams: URLSearchParams): Promise<NextResponse> {
  // Parse query parameters
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = (page - 1) * limit;
  
  // Build query for legacy table
  let query = supabaseAdmin!.from(DatabaseConfig.LEGACY_TABLE_NAME).select('*', { count: 'exact' });
  
  // Apply filters
  const appliedFilters = applyLegacyFilters(query, searchParams);
  
  // Apply sorting
  const sortBy = searchParams.get('sortBy') || 'date';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  
  if (sortBy === 'score') {
    // For legacy, we'll sort by date as a proxy for score
    query = query.order('date', { ascending: sortOrder === 'asc' });
  } else {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  }
  
  // Apply pagination
  query = query.range(offset, offset + limit - 1);
  
  const { data: legacyData, error, count } = await query;
  
  if (error) {
    throw new Error(`Legacy query failed: ${error.message}`);
  }
  
  // Convert legacy data to enhanced format
  const enhancedProperties: EnhancedProperty[] = (legacyData || []).map(convertLegacyToEnhanced);
  
  // Apply scoring if enabled
  if (FeatureFlags.VNEXT_SCORING_ENABLED) {
    const scoredProperties = await addScoringToProperties(enhancedProperties);
    enhancedProperties.splice(0, enhancedProperties.length, ...scoredProperties);
  }
  
  const response: PropertiesResponse = {
    properties: enhancedProperties,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      hasNext: offset + limit < (count || 0),
      hasPrev: page > 1
    },
    filters: {
      applied: appliedFilters,
      available: await getLegacyFilterOptions()
    },
    metadata: {
      scoringEnabled: FeatureFlags.VNEXT_SCORING_ENABLED,
      dataSource: 'legacy',
      lastUpdated: new Date().toISOString()
    }
  };
  
  return NextResponse.json(response);
}

/**
 * Handle request using vNext normalized schema
 */
async function handleVNextRequest(searchParams: URLSearchParams): Promise<NextResponse> {
  // Parse query parameters
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = (page - 1) * limit;
  const includeEvents = searchParams.get('includeEvents') === 'true';
  const includeContacts = searchParams.get('includeContacts') === 'true';
  
  // Build base query
  let query = supabaseAdmin!.from('properties').select(`
    *,
    ${includeEvents ? 'distress_events(*),' : ''}
    ${includeContacts ? 'property_contacts(*, contacts(*)),' : ''}
    lead_pipeline(stage)
  `, { count: 'exact' });
  
  // Apply filters
  const appliedFilters = await applyVNextFilters(query, searchParams);
  
  // Apply sorting
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  
  if (sortBy !== 'score') {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  }
  
  // Apply pagination
  query = query.range(offset, offset + limit - 1);
  
  const { data: properties, error, count } = await query;
  
  if (error) {
    throw new Error(`vNext query failed: ${error.message}`);
  }
  
  // Enhance properties with computed fields
  const enhancedProperties: EnhancedProperty[] = await Promise.all(
    (properties || []).map(async (property: any) => {
      const enhanced = await enhanceProperty(property, includeEvents, includeContacts);
      return enhanced;
    })
  );
  
  // Apply scoring if enabled
  let finalProperties = enhancedProperties;
  if (FeatureFlags.VNEXT_SCORING_ENABLED) {
    finalProperties = await addScoringToProperties(enhancedProperties);
  }
  
  // Sort by score if requested
  if (sortBy === 'score') {
    finalProperties.sort((a, b) => {
      const scoreA = a.score || 0;
      const scoreB = b.score || 0;
      return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    });
  }
  
  const response: PropertiesResponse = {
    properties: finalProperties,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      hasNext: offset + limit < (count || 0),
      hasPrev: page > 1
    },
    filters: {
      applied: appliedFilters,
      available: await getVNextFilterOptions()
    },
    metadata: {
      scoringEnabled: FeatureFlags.VNEXT_SCORING_ENABLED,
      dataSource: 'vnext',
      lastUpdated: new Date().toISOString()
    }
  };
  
  return NextResponse.json(response);
}

/**
 * Apply filters to legacy query
 */
function applyLegacyFilters(query: any, searchParams: URLSearchParams): Record<string, any> {
  const appliedFilters: Record<string, any> = {};
  
  // Date range filter
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  
  if (dateFrom) {
    query = query.gte('date', dateFrom);
    appliedFilters.dateFrom = dateFrom;
  }
  
  if (dateTo) {
    query = query.lte('date', dateTo);
    appliedFilters.dateTo = dateTo;
  }
  
  // Counties filter
  const counties = searchParams.get('counties');
  if (counties && counties !== '') {
    const countyList = counties.split(',').map(c => c.trim()).filter(c => c.length > 0);
    if (countyList.length > 0) {
      query = query.in('county', countyList);
      appliedFilters.counties = countyList;
    }
  }
  
  // Sources filter
  const sources = searchParams.get('sources');
  if (sources && sources !== '') {
    const sourceList = sources.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (sourceList.length > 0) {
      query = query.in('source', sourceList);
      appliedFilters.sources = sourceList;
    }
  }
  
  // Within 30 minutes filter
  const within30min = searchParams.get('within30min');
  if (within30min === 'true') {
    query = query.eq('within_30min', 'Y');
    appliedFilters.within30min = true;
  }
  
  // Nashville proximity filter (vNext style)
  const within30minNash = searchParams.get('within30minNash');
  if (within30minNash === 'true') {
    query = query.eq('within_30min', 'Y'); // Legacy fallback
    appliedFilters.within30minNash = true;
  }
  
  // Enrichment status filter
  const enrichmentStatus = searchParams.get('enrichmentStatus');
  if (enrichmentStatus === 'enriched') {
    query = query.or('owner_email_1.not.is.null,owner_phone_1.not.is.null');
    appliedFilters.enrichmentStatus = 'enriched';
  } else if (enrichmentStatus === 'needs_enrichment') {
    query = query.is('owner_email_1', null).is('owner_phone_1', null);
    appliedFilters.enrichmentStatus = 'needs_enrichment';
  }
  
  return appliedFilters;
}

/**
 * Apply filters to vNext query
 */
async function applyVNextFilters(query: any, searchParams: URLSearchParams): Promise<Record<string, any>> {
  const appliedFilters: Record<string, any> = {};
  
  // Date range filter
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  
  if (dateFrom || dateTo) {
    // For vNext, we need to filter by distress_events.event_date
    // This requires a more complex query
    appliedFilters.dateRange = { from: dateFrom, to: dateTo };
  }
  
  // Counties filter
  const counties = searchParams.get('counties');
  if (counties && counties !== '') {
    const countyList = counties.split(',').map(c => c.trim()).filter(c => c.length > 0);
    if (countyList.length > 0) {
      query = query.in('county', countyList);
      appliedFilters.counties = countyList;
    }
  }
  
  // Nashville proximity filter
  const within30minNash = searchParams.get('within30minNash');
  if (within30minNash === 'true') {
    query = query.eq('within_30min_nash', true);
    appliedFilters.within30minNash = true;
  }
  
  // Mt. Juliet proximity filter
  const within30minMtJuliet = searchParams.get('within30minMtJuliet');
  if (within30minMtJuliet === 'true') {
    query = query.eq('within_30min_mtjuliet', true);
    appliedFilters.within30minMtJuliet = true;
  }
  
  // Combined proximity filter (legacy compatibility)
  const within30min = searchParams.get('within30min');
  if (within30min === 'true') {
    query = query.or('within_30min_nash.eq.true,within_30min_mtjuliet.eq.true');
    appliedFilters.within30min = true;
  }
  
  // Property type filter
  const propertyTypes = searchParams.get('propertyTypes');
  if (propertyTypes && propertyTypes !== '') {
    const typeList = propertyTypes.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (typeList.length > 0) {
      query = query.in('property_type', typeList);
      appliedFilters.propertyTypes = typeList;
    }
  }
  
  // Lead pipeline stage filter
  const stages = searchParams.get('stages');
  if (stages && stages !== '') {
    const stageList = stages.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (stageList.length > 0) {
      // This would require joining with lead_pipeline table
      appliedFilters.stages = stageList;
    }
  }
  
  // Score range filter
  const minScore = searchParams.get('minScore');
  const maxScore = searchParams.get('maxScore');
  if (minScore || maxScore) {
    appliedFilters.scoreRange = { min: minScore, max: maxScore };
  }
  
  return appliedFilters;
}

/**
 * Convert legacy property to enhanced format
 */
function convertLegacyToEnhanced(legacyProperty: any): EnhancedProperty {
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(legacyProperty.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  const hasContact = legacyProperty.owner_email_1 || legacyProperty.owner_phone_1;
  
  return {
    id: legacyProperty.id.toString(),
    full_address: legacyProperty.address,
    street: legacyProperty.address.split(',')[0]?.trim(),
    city: legacyProperty.city,
    state: 'TN',
    zip: undefined,
    county: legacyProperty.county,
    parcel_apn: undefined,
    lat: undefined,
    lon: undefined,
    distance_nash_mi: legacyProperty.distance_miles,
    distance_mtjuliet_mi: undefined,
    within_30min_nash: legacyProperty.within_30min === 'Y',
    within_30min_mtjuliet: false,
    property_type: 'SFR',
    beds: undefined,
    baths: undefined,
    sqft: undefined,
    lot_sqft: undefined,
    data_confidence: 0.8,
    created_at: legacyProperty.created_at,
    updated_at: legacyProperty.updated_at,
    
    // Enhanced fields
    next_sale_date: legacyProperty.date,
    event_count: 1,
    enriched: hasContact,
    contact_count: hasContact ? 1 : 0,
    stage: hasContact ? 'enriched' : 'new',
    days_since_created: daysSinceCreated,
    is_recent: daysSinceCreated <= 7
  };
}

/**
 * Enhance property with computed fields
 */
async function enhanceProperty(
  property: any, 
  includeEvents: boolean, 
  includeContacts: boolean
): Promise<EnhancedProperty> {
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(property.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Get next sale date from events
  const events = property.distress_events || [];
  const upcomingEvents = events
    .filter((event: DistressEvent) => event.event_date && event.status === 'active')
    .sort((a: DistressEvent, b: DistressEvent) => 
      new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime()
    );
  
  const nextSaleDate = upcomingEvents.length > 0 ? upcomingEvents[0].event_date : undefined;
  
  // Get contact information
  const propertyContacts = property.property_contacts || [];
  const contacts = propertyContacts.map((pc: any) => pc.contacts).filter(Boolean);
  const hasContact = contacts.length > 0 && contacts.some((contact: Contact) => 
    (contact.phones && contact.phones.length > 0) || 
    (contact.emails && contact.emails.length > 0)
  );
  
  // Get pipeline stage
  const pipeline = property.lead_pipeline?.[0];
  const stage = pipeline?.stage || 'new';
  
  const enhanced: EnhancedProperty = {
    ...property,
    next_sale_date: nextSaleDate,
    event_count: events.length,
    enriched: hasContact,
    contact_count: contacts.length,
    stage,
    days_since_created: daysSinceCreated,
    is_recent: daysSinceCreated <= 7
  };
  
  // Add full data if requested
  if (includeEvents) {
    enhanced.events = events;
  }
  
  if (includeContacts) {
    enhanced.contacts = contacts;
  }
  
  return enhanced;
}

/**
 * Add scoring to properties
 */
async function addScoringToProperties(properties: EnhancedProperty[]): Promise<EnhancedProperty[]> {
  // Get investor rules
  const { data: investorRules } = await supabaseAdmin!
    .from('investor_rules')
    .select('*')
    .limit(1)
    .single();
  
  const scorer = investorRules 
    ? new (await import('@/lib/scoring')).PropertyScorer(investorRules)
    : createDefaultScorer();
  
  return properties.map(property => {
    const events = property.events || [];
    const contacts = property.contacts || [];
    
    const context = {
      property,
      events,
      contacts,
      propertyContacts: [], // Would need to be fetched separately
      investorRules: investorRules || scorer['investorRules']
    };
    
    const scoreResult = scorer.score(context);
    
    return {
      ...property,
      score: scoreResult.score,
      priority: scoreResult.priority,
      urgency_days: scoreResult.urgencyDays
    };
  });
}

/**
 * Get available filter options for legacy data
 */
async function getLegacyFilterOptions(): Promise<FilterOptions> {
  const { data: counties } = await supabaseAdmin!
    .from(DatabaseConfig.LEGACY_TABLE_NAME)
    .select('county')
    .not('county', 'is', null);
  
  const { data: sources } = await supabaseAdmin!
    .from(DatabaseConfig.LEGACY_TABLE_NAME)
    .select('source')
    .not('source', 'is', null);
  
  return {
    counties: [...new Set(counties?.map(c => c.county).filter(Boolean) || [])],
    sources: [...new Set(sources?.map(s => s.source).filter(Boolean) || [])],
    stages: ['new', 'enriched'],
    priorities: ['low', 'medium', 'high', 'urgent'],
    eventTypes: ['FORECLOSURE']
  };
}

/**
 * Get available filter options for vNext data
 */
async function getVNextFilterOptions(): Promise<FilterOptions> {
  const { data: counties } = await supabaseAdmin!
    .from('properties')
    .select('county')
    .not('county', 'is', null);
  
  const { data: sources } = await supabaseAdmin!
    .from('distress_events')
    .select('source')
    .not('source', 'is', null);
  
  const { data: stages } = await supabaseAdmin!
    .from('lead_pipeline')
    .select('stage')
    .not('stage', 'is', null);
  
  const { data: eventTypes } = await supabaseAdmin!
    .from('distress_events')
    .select('event_type')
    .not('event_type', 'is', null);
  
  return {
    counties: [...new Set(counties?.map(c => c.county).filter(Boolean) || [])],
    sources: [...new Set(sources?.map(s => s.source).filter(Boolean) || [])],
    stages: [...new Set(stages?.map(s => s.stage).filter(Boolean) || [])],
    priorities: ['low', 'medium', 'high', 'urgent'],
    eventTypes: [...new Set(eventTypes?.map(e => e.event_type).filter(Boolean) || [])]
  };
}

export { GET };
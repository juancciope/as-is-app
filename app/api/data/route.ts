import { NextRequest, NextResponse } from 'next/server';
import { supabase, FORECLOSURE_TABLE, ForeclosureData } from '../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    
    // Build the query
    let query = supabase.from(FORECLOSURE_TABLE).select('*');
    
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
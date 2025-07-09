import { NextRequest, NextResponse } from 'next/server';
import { supabase, FORECLOSURE_TABLE, ForeclosureData } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source') || 'unified';
    
    // Build the query
    let query = supabase.from(FORECLOSURE_TABLE).select('*');
    
    // Filter by source if not unified
    if (source !== 'unified') {
      query = query.eq('source', source);
    }
    
    // Apply filters if provided
    const withinRange = searchParams.get('within30min');
    const city = searchParams.get('city');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    if (withinRange === 'true') {
      query = query.eq('within_30min', 'Y');
    }
    
    if (city) {
      query = query.ilike('city', `%${city}%`);
    }
    
    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }
    
    if (dateTo) {
      query = query.lte('date', dateTo);
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
      source,
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
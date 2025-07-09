import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { id, owner_emails, owner_phones, owner_info, skip_trace } = data;

    if (!id) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Update the property in the database
    const { data: updatedProperty, error } = await supabaseAdmin
      .from('foreclosure_data')
      .update({
        owner_emails,
        owner_phones,
        owner_info,
        skip_trace,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating property:', error);
      return NextResponse.json(
        { error: 'Failed to update property' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedProperty,
    });
  } catch (error) {
    console.error('Error in enrich endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check enrichment status
export async function GET(request: Request) {
  try {
    // Get enrichment statistics
    const { data: stats, error } = await supabaseAdmin
      .rpc('get_enrichment_stats');

    if (error) {
      console.error('Error getting enrichment stats:', error);
      return NextResponse.json(
        { error: 'Failed to get enrichment statistics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      stats: stats[0] || {
        total_properties: 0,
        enriched_properties: 0,
        enrichment_percentage: 0,
        properties_with_emails: 0,
        properties_with_phones: 0,
        recent_enrichments: 0,
      },
    });
  } catch (error) {
    console.error('Error in enrichment stats endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
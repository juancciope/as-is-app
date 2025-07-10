import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// This endpoint triggers skip trace for a specific property
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { propertyId } = data;

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Fetch property details from database
    const { data: property, error: fetchError } = await supabaseAdmin
      .from('foreclosure_data')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (fetchError || !property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    // Check if property already has contact info
    if (property.owner_emails || property.owner_phones) {
      return NextResponse.json({
        success: true,
        message: 'Property already has contact information',
        data: {
          emails: property.owner_emails?.split(',') || [],
          phones: property.owner_phones?.split(',') || [],
          owners: property.owner_info?.split(' | ') || []
        }
      });
    }

    // Get the Apify actor webhook URL from environment variables
    const APIFY_WEBHOOK_URL = process.env.APIFY_SKIP_TRACE_WEBHOOK;
    const SERVICE_TOKEN = process.env.APIFY_SERVICE_TOKEN;

    if (!APIFY_WEBHOOK_URL || !SERVICE_TOKEN) {
      return NextResponse.json(
        { error: 'Skip trace service not configured' },
        { status: 500 }
      );
    }

    // Send skip trace request to Apify actor
    const skipTraceResponse = await fetch(`${APIFY_WEBHOOK_URL}/skip-trace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_TOKEN}`
      },
      body: JSON.stringify({
        propertyId: property.id,
        address: property.address
      })
    });

    if (!skipTraceResponse.ok) {
      const errorText = await skipTraceResponse.text();
      console.error('Skip trace service error:', errorText);
      return NextResponse.json(
        { error: 'Skip trace service failed' },
        { status: 500 }
      );
    }

    const skipTraceResult = await skipTraceResponse.json();

    if (skipTraceResult.success && skipTraceResult.data) {
      // Update property with skip trace data
      const { data: updatedProperty, error: updateError } = await supabaseAdmin
        .from('foreclosure_data')
        .update({
          owner_emails: skipTraceResult.data.emails.join(','),
          owner_phones: skipTraceResult.data.phones.join(','),
          owner_info: skipTraceResult.data.owners.join(' | '),
          skip_trace: {
            attempted_at: new Date().toISOString(),
            method: 'connected_investors_manual',
            results: skipTraceResult.data
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', propertyId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating property:', updateError);
        return NextResponse.json(
          { error: 'Failed to update property' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Skip trace completed successfully',
        data: skipTraceResult.data
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'No skip trace data found',
        error: skipTraceResult.error
      });
    }

  } catch (error) {
    console.error('Skip trace endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
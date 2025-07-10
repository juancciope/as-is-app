import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ApifyClient } from 'apify-client';

// Initialize Apify client
const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

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

    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json(
        { error: 'Apify API token not configured' },
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
    if (property.owner_emails || property.owner_phones || property.owner_email_1) {
      // Collect emails from individual columns
      const emails = [];
      for (let i = 1; i <= 5; i++) {
        if (property[`owner_email_${i}`]) {
          emails.push(property[`owner_email_${i}`]);
        }
      }
      
      // Collect phones from individual columns
      const phones = [];
      for (let i = 1; i <= 5; i++) {
        if (property[`owner_phone_${i}`]) {
          phones.push(property[`owner_phone_${i}`]);
        }
      }
      
      // Also include legacy comma-separated values if no individual columns
      if (emails.length === 0 && property.owner_emails) {
        emails.push(...property.owner_emails.split(','));
      }
      if (phones.length === 0 && property.owner_phones) {
        phones.push(...property.owner_phones.split(','));
      }
      
      return NextResponse.json({
        success: true,
        message: 'Property already has contact information',
        data: {
          emails: emails,
          phones: phones,
          owners: property.owner_info?.split(' | ') || []
        }
      });
    }

    // Get the Connected Investors actor ID
    const actorId = process.env.APIFY_ACTOR_ID_SKIP_TRACE || 'connected-investors-skip-trace-service';

    try {
      // Run the actor with skip trace request
      const run = await apifyClient.actor(actorId).call({
        username: process.env.CONNECTED_INVESTORS_USERNAME,
        password: process.env.CONNECTED_INVESTORS_PASSWORD,
        propertyId: property.id,
        address: property.address
      });

      // Wait for the run to complete
      const finishedRun = await apifyClient.run(run.id).waitForFinish();

      if (finishedRun.status !== 'SUCCEEDED') {
        console.error('Actor run failed:', finishedRun.status);
        return NextResponse.json(
          { error: 'Skip trace failed' },
          { status: 500 }
        );
      }

      // Get the results from the actor run
      const { items } = await apifyClient.dataset(finishedRun.defaultDatasetId).listItems();

      if (items.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'No skip trace data found'
        });
      }

      const result = items[0] as any;

      if (result.success && result.data) {
        // Prepare update object with individual email and phone columns
        const updateData: any = {
          owner_info: result.data.owners?.join(' | ') || '',
          skip_trace: {
            attempted_at: new Date().toISOString(),
            method: 'connected_investors_api',
            results: result.data,
            runId: run.id
          },
          updated_at: new Date().toISOString()
        };

        // Add up to 5 emails
        if (result.data.emails && Array.isArray(result.data.emails)) {
          for (let i = 0; i < 5; i++) {
            updateData[`owner_email_${i + 1}`] = result.data.emails[i] || null;
          }
        }

        // Add up to 5 phone numbers
        if (result.data.phones && Array.isArray(result.data.phones)) {
          for (let i = 0; i < 5; i++) {
            updateData[`owner_phone_${i + 1}`] = result.data.phones[i] || null;
          }
        }

        // Keep legacy columns for backward compatibility
        updateData.owner_emails = result.data.emails?.join(',') || '';
        updateData.owner_phones = result.data.phones?.join(',') || '';

        // Update property with skip trace data
        const { data: updatedProperty, error: updateError } = await supabaseAdmin
          .from('foreclosure_data')
          .update(updateData)
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
          data: result.data
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'No skip trace data found',
          error: result.error
        });
      }

    } catch (apifyError) {
      console.error('Apify API error:', apifyError);
      return NextResponse.json(
        { error: 'Failed to run skip trace actor' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Skip trace endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
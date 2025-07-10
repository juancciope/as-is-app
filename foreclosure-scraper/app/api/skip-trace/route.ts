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
    if (property.owner_email_1 || property.owner_phone_1) {
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
      
      // Note: Legacy columns removed since they don't exist in the database
      
      // Collect owner names
      const parsedOwners = [];
      for (let i = 1; i <= 2; i++) {
        const firstName = property[`owner_${i}_first_name`];
        const lastName = property[`owner_${i}_last_name`];
        if (firstName || lastName) {
          parsedOwners.push({
            firstName: firstName || '',
            lastName: lastName || '',
            fullName: `${firstName || ''} ${lastName || ''}`.trim()
          });
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Property already has contact information',
        data: {
          emails: emails,
          phones: phones,
          owners: [], // Legacy owner_info column also doesn't exist
          parsedOwners: parsedOwners
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
        console.error('Run details:', finishedRun);
        return NextResponse.json(
          { 
            error: 'Skip trace failed',
            status: finishedRun.status,
            details: finishedRun.statusMessage || 'Actor run did not complete successfully'
          },
          { status: 500 }
        );
      }

      // Get the results from the actor run
      const { items } = await apifyClient.dataset(finishedRun.defaultDatasetId).listItems();

      console.log('Actor run items:', JSON.stringify(items, null, 2));

      if (items.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'No skip trace data found'
        });
      }

      const result = items[0] as any;
      console.log('Processing result:', JSON.stringify(result, null, 2));

      if (result.success && result.data) {
        // Prepare update object with individual email and phone columns
        const updateData: any = {
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

        // Add owner names (up to 2 owners)
        if (result.data.parsedOwners && Array.isArray(result.data.parsedOwners)) {
          for (let i = 0; i < 2; i++) {
            const owner = result.data.parsedOwners[i];
            if (owner) {
              updateData[`owner_${i + 1}_first_name`] = owner.firstName || null;
              updateData[`owner_${i + 1}_last_name`] = owner.lastName || null;
            } else {
              updateData[`owner_${i + 1}_first_name`] = null;
              updateData[`owner_${i + 1}_last_name`] = null;
            }
          }
        }

        // Note: Legacy columns owner_emails and owner_phones removed since they don't exist
        // All data is now stored in individual columns (owner_email_1, owner_phone_1, etc.)

        // Update property with skip trace data
        const { data: updatedProperty, error: updateError } = await supabaseAdmin
          .from('foreclosure_data')
          .update(updateData)
          .eq('id', propertyId)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating property:', updateError);
          console.error('Update data that failed:', JSON.stringify(updateData, null, 2));
          return NextResponse.json(
            { 
              error: 'Failed to update property', 
              details: updateError.message,
              code: updateError.code 
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Skip trace completed successfully',
          data: {
            emails: result.data.emails || [],
            phones: result.data.phones || [],
            owners: result.data.owners || [],
            parsedOwners: result.data.parsedOwners || []
          }
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
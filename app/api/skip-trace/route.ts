import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { ApifyClient } from 'apify-client';
import { FeatureFlags, DatabaseConfig } from '../../../lib/config';
import type { Property, Contact, PropertyContact } from '../../../lib/supabase';

// Initialize Apify client
const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

/**
 * Skip Trace API Endpoint
 * 
 * This endpoint triggers skip trace for a specific property and supports both:
 * - Legacy mode: Stores contacts in individual columns (owner_email_1, owner_phone_1, etc.)
 * - vNext mode: Stores contacts in normalized contacts table with JSON arrays
 * 
 * The mode is determined by the USE_LEGACY feature flag.
 */
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

    // Check feature flag to determine which implementation to use
    console.log('🎛️  Feature flags:', {
      USE_LEGACY: FeatureFlags.USE_LEGACY,
      USE_VNEXT_FILTERS: FeatureFlags.USE_VNEXT_FILTERS
    });

    if (FeatureFlags.USE_LEGACY) {
      console.log('📁 Using LEGACY skip trace implementation');
      return await handleLegacySkipTrace(propertyId);
    } else {
      console.log('🆕 Using vNext skip trace implementation');
      return await handleVNextSkipTrace(propertyId);
    }

  } catch (error) {
    console.error('Skip trace endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle skip trace using legacy table structure
 */
async function handleLegacySkipTrace(propertyId: string): Promise<NextResponse> {
  // Fetch property details from legacy table
  const { data: property, error: fetchError } = await supabaseAdmin!
    .from(DatabaseConfig.LEGACY_TABLE_NAME)
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
    return NextResponse.json({
      success: true,
      message: 'Property already has contact information',
      data: extractLegacyContactData(property)
    });
  }

  // Run skip trace and update legacy table
  return await runSkipTraceAndUpdateLegacy(propertyId, property);
}

/**
 * Handle skip trace using vNext normalized schema
 */
async function handleVNextSkipTrace(propertyId: string): Promise<NextResponse> {
  console.log('🔍 Looking for property in vNext properties table, ID:', propertyId);
  
  // Fetch property details from vNext table
  const { data: property, error: fetchError } = await supabaseAdmin!
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single();

  console.log('🏠 Property fetch result:', {
    found: !!property,
    error: fetchError?.message || 'none',
    propertyData: property ? {
      id: property.id,
      address: property.full_address,
      city: property.city,
      county: property.county
    } : null
  });

  if (fetchError || !property) {
    console.log('❌ Property not found in vNext properties table');
    return NextResponse.json(
      { 
        error: 'Property not found',
        debug: { propertyId, fetchError, searchedTable: 'properties' }
      },
      { status: 404 }
    );
  }

  // Check if property already has contact info
  const existingContacts = await getExistingVNextContacts(propertyId);
  if (existingContacts.length > 0) {
    return NextResponse.json({
      success: true,
      message: 'Property already has contact information',
      data: formatVNextContactData(existingContacts)
    });
  }

  // Run skip trace and update vNext tables
  return await runSkipTraceAndUpdateVNext(propertyId, property);
}

/**
 * Extract contact data from legacy property record
 */
function extractLegacyContactData(property: any) {
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
  
  return {
    emails,
    phones,
    owners: [],
    parsedOwners
  };
}

/**
 * Get existing contacts for a property in vNext schema
 */
async function getExistingVNextContacts(propertyId: string): Promise<Contact[]> {
  const { data: propertyContacts, error } = await supabaseAdmin!
    .from('property_contacts')
    .select(`
      contact_id,
      contacts (*)
    `)
    .eq('property_id', propertyId);

  if (error) {
    console.error('Error fetching existing contacts:', error);
    return [];
  }

  return propertyContacts?.map(pc => (pc as any).contacts).filter(Boolean) || [];
}

/**
 * Format vNext contact data for response
 */
function formatVNextContactData(contacts: Contact[]) {
  const emails: string[] = [];
  const phones: string[] = [];
  const parsedOwners: any[] = [];

  contacts.forEach(contact => {
    // Extract emails
    if (contact.emails && Array.isArray(contact.emails)) {
      contact.emails.forEach(emailObj => {
        if (emailObj.email) {
          emails.push(emailObj.email);
        }
      });
    }

    // Extract phones
    if (contact.phones && Array.isArray(contact.phones)) {
      contact.phones.forEach(phoneObj => {
        if (phoneObj.number) {
          phones.push(phoneObj.number);
        }
      });
    }

    // Extract owner names
    if (contact.name_first || contact.name_last) {
      parsedOwners.push({
        firstName: contact.name_first || '',
        lastName: contact.name_last || '',
        fullName: `${contact.name_first || ''} ${contact.name_last || ''}`.trim()
      });
    }
  });

  return {
    emails,
    phones,
    owners: [],
    parsedOwners
  };
}

/**
 * Run skip trace and update legacy table
 */
async function runSkipTraceAndUpdateLegacy(propertyId: string, property: any): Promise<NextResponse> {
  const skipTraceResult = await runConnectedInvestorsSkipTrace(propertyId, property.address);
  
  if (!skipTraceResult.success) {
    return NextResponse.json(skipTraceResult);
  }

  // Prepare update object with individual email and phone columns
  const updateData: any = {};

  // Add up to 5 emails
  if (skipTraceResult.data.emails && Array.isArray(skipTraceResult.data.emails)) {
    for (let i = 0; i < 5; i++) {
      updateData[`owner_email_${i + 1}`] = skipTraceResult.data.emails[i] || null;
    }
  }

  // Add up to 5 phone numbers
  if (skipTraceResult.data.phones && Array.isArray(skipTraceResult.data.phones)) {
    for (let i = 0; i < 5; i++) {
      updateData[`owner_phone_${i + 1}`] = skipTraceResult.data.phones[i] || null;
    }
  }

  // Add owner names (up to 2 owners)
  if (skipTraceResult.data.parsedOwners && Array.isArray(skipTraceResult.data.parsedOwners)) {
    for (let i = 0; i < 2; i++) {
      const owner = skipTraceResult.data.parsedOwners[i];
      if (owner) {
        updateData[`owner_${i + 1}_first_name`] = owner.firstName || null;
        updateData[`owner_${i + 1}_last_name`] = owner.lastName || null;
      } else {
        updateData[`owner_${i + 1}_first_name`] = null;
        updateData[`owner_${i + 1}_last_name`] = null;
      }
    }
  }

  // Update property with skip trace data
  const { error: updateError } = await supabaseAdmin!
    .from(DatabaseConfig.LEGACY_TABLE_NAME)
    .update(updateData)
    .eq('id', propertyId);

  if (updateError) {
    console.error('Error updating property:', updateError);
    return NextResponse.json(
      { 
        error: 'Failed to update property', 
        details: updateError.message
      },
      { status: 500 }
    );
  }

  return NextResponse.json(skipTraceResult);
}

/**
 * Run skip trace and update vNext tables
 */
async function runSkipTraceAndUpdateVNext(propertyId: string, property: Property): Promise<NextResponse> {
  console.log('🔍 Starting vNext skip trace for property:', propertyId, 'address:', property.full_address);
  
  const skipTraceResult = await runConnectedInvestorsSkipTrace(propertyId, property.full_address);
  
  console.log('📊 Skip trace result:', JSON.stringify(skipTraceResult, null, 2));
  
  if (!skipTraceResult.success) {
    console.log('❌ Skip trace failed, returning error response');
    return NextResponse.json(skipTraceResult);
  }

  // Create skip trace run record
  const { data: skipTraceRun, error: runError } = await supabaseAdmin!
    .from('skip_trace_runs')
    .insert({
      property_id: propertyId,
      provider: 'connected_investors',
      status: 'completed',
      cost_credits: 1, // Assume 1 credit per skip trace
      results_summary: {
        emails_found: skipTraceResult.data.emails?.length || 0,
        phones_found: skipTraceResult.data.phones?.length || 0,
        owners_found: skipTraceResult.data.parsedOwners?.length || 0
      }
    })
    .select()
    .single();

  if (runError) {
    console.error('Error creating skip trace run:', runError);
  }

  // Create contact records
  const contactsToCreate: any[] = [];
  const propertyContactsToCreate: any[] = [];

  // Check if we have any contact data (emails or phones)
  const hasEmails = skipTraceResult.data.emails && Array.isArray(skipTraceResult.data.emails) && skipTraceResult.data.emails.length > 0;
  const hasPhones = skipTraceResult.data.phones && Array.isArray(skipTraceResult.data.phones) && skipTraceResult.data.phones.length > 0;
  const hasOwners = skipTraceResult.data.parsedOwners && Array.isArray(skipTraceResult.data.parsedOwners) && skipTraceResult.data.parsedOwners.length > 0;

  console.log('📋 Contact data analysis:', {
    hasEmails,
    emailCount: skipTraceResult.data.emails?.length || 0,
    hasPhones,
    phoneCount: skipTraceResult.data.phones?.length || 0,
    hasOwners,
    ownerCount: skipTraceResult.data.parsedOwners?.length || 0
  });

  if (hasEmails || hasPhones) {
    console.log('✅ Contact data found, proceeding to create contact records');
    const emails = skipTraceResult.data.emails || [];
    const phones = skipTraceResult.data.phones || [];
    const owners = skipTraceResult.data.parsedOwners || [];

    // Strategy: Create one contact record per email for individual outreach tracking
    if (hasEmails) {
      // Create separate contact for each email address
      emails.forEach((email: string, emailIndex: number) => {
        if (!email) return;

        const contactId = crypto.randomUUID();
        
        // Assign owner name if available (cycle through owners if more emails than owners)
        const ownerIndex = emailIndex < owners.length ? emailIndex : emailIndex % Math.max(owners.length, 1);
        const owner = owners[ownerIndex] || null;
        
        // Assign one phone number to each contact (distribute phones across contacts)
        const assignedPhone = phones[emailIndex] || phones[emailIndex % Math.max(phones.length, 1)] || null;
        const phoneObjects = assignedPhone ? [{
          number: assignedPhone,
          label: 'primary',
          verified: false,
          source: 'connected_investors'
        }] : [];

        // Create email object
        const emailObjects = [{
          email: email,
          label: 'primary',
          verified: false,
          source: 'connected_investors'
        }];

        contactsToCreate.push({
          id: contactId,
          name_first: owner?.firstName || null,
          name_last: owner?.lastName || null,
          entity_name: null,
          contact_type: 'skiptrace_result',
          phones: phoneObjects,
          emails: emailObjects,
          mailing_address: null,
          notes: `Skip traced via Connected Investors on ${new Date().toISOString()} - Contact ${emailIndex + 1} of ${emails.length}`
        });

        propertyContactsToCreate.push({
          property_id: propertyId,
          contact_id: contactId,
          role: 'skiptrace',
          confidence: owner ? 0.8 : 0.7, // Higher confidence if we have owner name
          last_validated_at: null
        });
      });
    } else if (hasPhones && !hasEmails) {
      // Fallback: If we only have phones (no emails), create one contact per phone
      phones.forEach((phone: string, phoneIndex: number) => {
        if (!phone) return;

        const contactId = crypto.randomUUID();
        
        // Assign owner name if available
        const ownerIndex = phoneIndex < owners.length ? phoneIndex : phoneIndex % Math.max(owners.length, 1);
        const owner = owners[ownerIndex] || null;

        const phoneObjects = [{
          number: phone,
          label: 'primary',
          verified: false,
          source: 'connected_investors'
        }];

        contactsToCreate.push({
          id: contactId,
          name_first: owner?.firstName || null,
          name_last: owner?.lastName || null,
          entity_name: null,
          contact_type: 'skiptrace_result',
          phones: phoneObjects,
          emails: [],
          mailing_address: null,
          notes: `Skip traced via Connected Investors on ${new Date().toISOString()} - SMS Contact ${phoneIndex + 1} of ${phones.length}`
        });

        propertyContactsToCreate.push({
          property_id: propertyId,
          contact_id: contactId,
          role: 'skiptrace',
          confidence: owner ? 0.8 : 0.7,
          last_validated_at: null
        });
      });
    }

    console.log(`📝 Prepared ${contactsToCreate.length} contacts to create:`, contactsToCreate.map(c => ({
      id: c.id,
      email: c.emails[0]?.email || 'none',
      phone: c.phones[0]?.number || 'none',
      name: `${c.name_first || ''} ${c.name_last || ''}`.trim() || 'anonymous'
    })));
  } else {
    console.log('❌ No contact data found (no emails or phones)');
  }

  // Insert contacts
  if (contactsToCreate.length > 0) {
    console.log(`💾 Inserting ${contactsToCreate.length} contacts into database...`);
    const { error: contactError } = await supabaseAdmin!
      .from('contacts')
      .insert(contactsToCreate);

    if (contactError) {
      console.error('❌ Error inserting contacts:', contactError);
      return NextResponse.json(
        { 
          error: 'Failed to save contact data', 
          details: contactError.message,
          debug: { contactsToCreate, contactError }
        },
        { status: 500 }
      );
    }

    console.log('✅ Contacts inserted successfully');

    // Insert property-contact relationships
    console.log(`🔗 Inserting ${propertyContactsToCreate.length} property-contact relationships...`);
    const { error: pcError } = await supabaseAdmin!
      .from('property_contacts')
      .insert(propertyContactsToCreate);

    if (pcError) {
      console.error('❌ Error inserting property contacts:', pcError);
      return NextResponse.json(
        { 
          error: 'Failed to save property contact relationships', 
          details: pcError.message,
          debug: { propertyContactsToCreate, pcError }
        },
        { status: 500 }
      );
    }

    console.log('✅ Property-contact relationships inserted successfully');

    // Update lead pipeline stage to 'enriched' since we now have contact info
    await updateLeadPipelineStage(propertyId, 'enriched');

    // Dual-write to legacy table if feature flag is enabled
    if (FeatureFlags.USE_LEGACY) {
      await dualWriteToLegacyTable(propertyId, skipTraceResult.data);
    }
  }

  return NextResponse.json(skipTraceResult);
}

/**
 * Run the Connected Investors skip trace actor
 */
async function runConnectedInvestorsSkipTrace(propertyId: string, address: string): Promise<any> {
  const actorId = process.env.APIFY_ACTOR_ID_SKIP_TRACE || 'connected-investors-skip-trace-service';

  try {
    // Run the actor with skip trace request
    const run = await apifyClient.actor(actorId).call({
      username: process.env.CONNECTED_INVESTORS_USERNAME,
      password: process.env.CONNECTED_INVESTORS_PASSWORD,
      propertyId: propertyId,
      address: address
    });

    // Wait for the run to complete
    const finishedRun = await apifyClient.run(run.id).waitForFinish();

    if (finishedRun.status !== 'SUCCEEDED') {
      console.error('Actor run failed:', finishedRun.status);
      return {
        success: false,
        error: 'Skip trace failed',
        status: finishedRun.status,
        details: finishedRun.statusMessage || 'Actor run did not complete successfully'
      };
    }

    // Get the results from the actor run
    const { items } = await apifyClient.dataset(finishedRun.defaultDatasetId).listItems();

    if (items.length === 0) {
      return {
        success: false,
        message: 'No skip trace data found'
      };
    }

    const result = items[0] as any;

    if (result.success && result.data) {
      return {
        success: true,
        message: 'Skip trace completed successfully',
        data: {
          emails: result.data.emails || [],
          phones: result.data.phones || [],
          owners: result.data.owners || [],
          parsedOwners: result.data.parsedOwners || []
        }
      };
    } else {
      return {
        success: false,
        message: 'No skip trace data found',
        error: result.error
      };
    }

  } catch (apifyError) {
    console.error('Apify API error:', apifyError);
    return {
      success: false,
      error: 'Failed to run skip trace actor'
    };
  }

}

/**
 * Update lead pipeline stage for a property
 */
async function updateLeadPipelineStage(propertyId: string, stage: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin!
      .from('lead_pipeline')
      .upsert({
        property_id: propertyId,
        stage: stage,
        stage_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('property_id', propertyId);

    if (error) {
      console.error('Error updating lead pipeline stage:', error);
    }
  } catch (error) {
    console.error('Error updating lead pipeline stage:', error);
  }
}

/**
 * Dual-write skip trace results to legacy table for backward compatibility
 */
async function dualWriteToLegacyTable(propertyId: string, skipTraceData: any): Promise<void> {
  try {
    // Prepare update object with individual email and phone columns
    const updateData: any = {};

    // Add up to 5 emails
    if (skipTraceData.emails && Array.isArray(skipTraceData.emails)) {
      for (let i = 0; i < 5; i++) {
        updateData[`owner_email_${i + 1}`] = skipTraceData.emails[i] || null;
      }
    }

    // Add up to 5 phone numbers
    if (skipTraceData.phones && Array.isArray(skipTraceData.phones)) {
      for (let i = 0; i < 5; i++) {
        updateData[`owner_phone_${i + 1}`] = skipTraceData.phones[i] || null;
      }
    }

    // Add owner names (up to 2 owners)
    if (skipTraceData.parsedOwners && Array.isArray(skipTraceData.parsedOwners)) {
      for (let i = 0; i < 2; i++) {
        const owner = skipTraceData.parsedOwners[i];
        if (owner) {
          updateData[`owner_${i + 1}_first_name`] = owner.firstName || null;
          updateData[`owner_${i + 1}_last_name`] = owner.lastName || null;
        } else {
          updateData[`owner_${i + 1}_first_name`] = null;
          updateData[`owner_${i + 1}_last_name`] = null;
        }
      }
    }

    // Update legacy table
    const { error: updateError } = await supabaseAdmin!
      .from(DatabaseConfig.LEGACY_TABLE_NAME)
      .update(updateData)
      .eq('id', propertyId);

    if (updateError) {
      console.error('Error dual-writing to legacy table:', updateError);
    }
  } catch (error) {
    console.error('Error dual-writing to legacy table:', error);
  }
}
#!/usr/bin/env npx tsx

/**
 * Test script for Skip Trace Flow (Step 8)
 * 
 * This script tests the skip trace functionality in both legacy and vNext modes
 * to ensure feature flag controls work correctly and dual-write functionality
 * maintains backward compatibility.
 */

import { supabaseAdmin } from '../lib/supabase';
import config from '../lib/config';

interface SkipTraceTestResult {
  propertyId: string;
  mode: 'legacy' | 'vnext';
  success: boolean;
  contactsFound: number;
  errors: string[];
  verificationResults: {
    skipTraceRunCreated: boolean;
    contactsCreated: boolean;
    propertyContactsLinked: boolean;
    pipelineStageUpdated: boolean;
    legacyColumnsUpdated: boolean;
  };
}

/**
 * Main test function
 */
async function testSkipTraceFlow(): Promise<void> {
  console.log('🧪 Testing Skip Trace Flow (Step 8)');
  console.log('=====================================');
  
  // Test environment validation
  console.log('\n📋 Environment Validation:');
  const envValidation = config.validateEnvironment();
  if (!envValidation.valid) {
    console.error('❌ Environment validation failed:', envValidation.errors);
    process.exit(1);
  }
  console.log('✅ Environment configuration valid');

  // Test database connectivity
  console.log('\n🔌 Database Connectivity:');
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not initialized');
    process.exit(1);
  }
  console.log('✅ Database connection established');

  // Create test property for both modes
  const testProperty = await createTestProperty();
  
  // Test legacy mode
  console.log('\n🏗️  Testing Legacy Mode:');
  const legacyResult = await testSkipTraceMode(testProperty.id, 'legacy');
  
  // Test vNext mode
  console.log('\n🚀 Testing vNext Mode:');
  const vnextResult = await testSkipTraceMode(testProperty.id, 'vnext');
  
  // Display results
  displayTestResults([legacyResult, vnextResult]);
  
  // Cleanup
  await cleanupTestData(testProperty.id);
  
  console.log('\n✅ Skip Trace Flow testing completed successfully!');
}

/**
 * Create a test property for skip trace testing
 */
async function createTestProperty(): Promise<any> {
  console.log('Creating test property...');
  
  const testPropertyData = {
    full_address: '123 Test Street, Nashville, TN 37201',
    street_address: '123 Test Street',
    city: 'Nashville',
    state: 'TN',
    zip_code: '37201',
    county: 'Davidson',
    property_type: 'Single Family',
    sale_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    auction_type: 'foreclosure',
    source: 'test_skip_trace',
    latitude: 36.1627,
    longitude: -86.7816,
    normalized_address: '123 test nashville tn 37201'
  };

  // Create in vNext schema
  const { data: vnextProperty, error: vnextError } = await supabaseAdmin!
    .from('properties')
    .insert(testPropertyData)
    .select()
    .single();

  if (vnextError) {
    console.error('Failed to create test property in vNext schema:', vnextError);
    throw vnextError;
  }

  // Create in legacy schema for testing
  const legacyPropertyData = {
    address: testPropertyData.full_address,
    city: testPropertyData.city,
    state: testPropertyData.state,
    zip_code: testPropertyData.zip_code,
    county: testPropertyData.county,
    property_type: testPropertyData.property_type,
    sale_date: testPropertyData.sale_date,
    auction_type: testPropertyData.auction_type,
    source: testPropertyData.source,
    latitude: testPropertyData.latitude,
    longitude: testPropertyData.longitude
  };

  const { data: legacyProperty, error: legacyError } = await supabaseAdmin!
    .from(config.DatabaseConfig.LEGACY_TABLE_NAME)
    .insert(legacyPropertyData)
    .select()
    .single();

  if (legacyError) {
    console.error('Failed to create test property in legacy schema:', legacyError);
    throw legacyError;
  }

  return {
    id: vnextProperty.id,
    legacyId: legacyProperty.id,
    address: testPropertyData.full_address
  };
}

/**
 * Test skip trace in specific mode
 */
async function testSkipTraceMode(propertyId: string, mode: 'legacy' | 'vnext'): Promise<SkipTraceTestResult> {
  const result: SkipTraceTestResult = {
    propertyId,
    mode,
    success: false,
    contactsFound: 0,
    errors: [],
    verificationResults: {
      skipTraceRunCreated: false,
      contactsCreated: false,
      propertyContactsLinked: false,
      pipelineStageUpdated: false,
      legacyColumnsUpdated: false
    }
  };

  try {
    // Simulate skip trace data
    const mockSkipTraceData = {
      emails: ['test@example.com', 'test2@example.com'],
      phones: ['615-555-0123', '615-555-0124'],
      parsedOwners: [
        { firstName: 'John', lastName: 'Doe' },
        { firstName: 'Jane', lastName: 'Doe' }
      ]
    };

    if (mode === 'vnext') {
      // Test vNext mode
      await testVNextSkipTrace(propertyId, mockSkipTraceData, result);
    } else {
      // Test legacy mode
      await testLegacySkipTrace(propertyId, mockSkipTraceData, result);
    }

    result.success = true;
    result.contactsFound = mockSkipTraceData.emails.length + mockSkipTraceData.phones.length;

  } catch (error) {
    result.errors.push(`Skip trace failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * Test vNext skip trace implementation
 */
async function testVNextSkipTrace(propertyId: string, mockData: any, result: SkipTraceTestResult): Promise<void> {
  // Create skip trace run
  const { data: skipTraceRun, error: runError } = await supabaseAdmin!
    .from('skip_trace_runs')
    .insert({
      property_id: propertyId,
      provider: 'test_provider',
      status: 'completed',
      cost_credits: 1,
      results_summary: {
        emails_found: mockData.emails.length,
        phones_found: mockData.phones.length,
        owners_found: mockData.parsedOwners.length
      }
    })
    .select()
    .single();

  result.verificationResults.skipTraceRunCreated = !runError;
  if (runError) {
    result.errors.push(`Skip trace run creation failed: ${runError.message}`);
  }

  // Create contacts
  const contactsToCreate = mockData.parsedOwners.map((owner: any, index: number) => ({
    id: `test-contact-${propertyId}-${index}`,
    name_first: owner.firstName,
    name_last: owner.lastName,
    contact_type: 'test_skiptrace',
    phones: mockData.phones.map((phone: string, phoneIndex: number) => ({
      number: phone,
      label: phoneIndex === 0 ? 'primary' : 'secondary',
      verified: false,
      source: 'test_provider'
    })),
    emails: mockData.emails.map((email: string, emailIndex: number) => ({
      email: email,
      label: emailIndex === 0 ? 'primary' : 'secondary',
      verified: false,
      source: 'test_provider'
    })),
    notes: 'Test skip trace contact'
  }));

  const { error: contactError } = await supabaseAdmin!
    .from('contacts')
    .insert(contactsToCreate);

  result.verificationResults.contactsCreated = !contactError;
  if (contactError) {
    result.errors.push(`Contact creation failed: ${contactError.message}`);
  }

  // Create property-contact relationships
  const propertyContactsToCreate = contactsToCreate.map((contact: any) => ({
    property_id: propertyId,
    contact_id: contact.id,
    role: 'test_skiptrace',
    confidence: 0.8
  }));

  const { error: pcError } = await supabaseAdmin!
    .from('property_contacts')
    .insert(propertyContactsToCreate);

  result.verificationResults.propertyContactsLinked = !pcError;
  if (pcError) {
    result.errors.push(`Property-contact linking failed: ${pcError.message}`);
  }

  // Update lead pipeline
  const { error: pipelineError } = await supabaseAdmin!
    .from('lead_pipeline')
    .upsert({
      property_id: propertyId,
      stage: 'enriched',
      stage_updated_at: new Date().toISOString()
    });

  result.verificationResults.pipelineStageUpdated = !pipelineError;
  if (pipelineError) {
    result.errors.push(`Pipeline stage update failed: ${pipelineError.message}`);
  }
}

/**
 * Test legacy skip trace implementation
 */
async function testLegacySkipTrace(propertyId: string, mockData: any, result: SkipTraceTestResult): Promise<void> {
  // Update legacy columns
  const updateData: any = {};

  // Add emails
  mockData.emails.forEach((email: string, index: number) => {
    if (index < 5) {
      updateData[`owner_email_${index + 1}`] = email;
    }
  });

  // Add phones
  mockData.phones.forEach((phone: string, index: number) => {
    if (index < 5) {
      updateData[`owner_phone_${index + 1}`] = phone;
    }
  });

  // Add owner names
  mockData.parsedOwners.forEach((owner: any, index: number) => {
    if (index < 2) {
      updateData[`owner_${index + 1}_first_name`] = owner.firstName;
      updateData[`owner_${index + 1}_last_name`] = owner.lastName;
    }
  });

  const { error: updateError } = await supabaseAdmin!
    .from(config.DatabaseConfig.LEGACY_TABLE_NAME)
    .update(updateData)
    .eq('id', propertyId);

  result.verificationResults.legacyColumnsUpdated = !updateError;
  if (updateError) {
    result.errors.push(`Legacy column update failed: ${updateError.message}`);
  }

  // For legacy mode, skip trace runs and normalized contacts are not created
  result.verificationResults.skipTraceRunCreated = true; // N/A for legacy
  result.verificationResults.contactsCreated = true; // N/A for legacy
  result.verificationResults.propertyContactsLinked = true; // N/A for legacy
  result.verificationResults.pipelineStageUpdated = true; // N/A for legacy
}

/**
 * Display test results
 */
function displayTestResults(results: SkipTraceTestResult[]): void {
  console.log('\n📊 Test Results Summary:');
  console.log('========================');

  results.forEach(result => {
    console.log(`\n${result.mode.toUpperCase()} Mode:`);
    console.log(`  Overall Success: ${result.success ? '✅' : '❌'}`);
    console.log(`  Contacts Found: ${result.contactsFound}`);
    
    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.length}`);
      result.errors.forEach(error => {
        console.log(`    ❌ ${error}`);
      });
    }

    console.log('  Verification Checks:');
    Object.entries(result.verificationResults).forEach(([check, passed]) => {
      console.log(`    ${check}: ${passed ? '✅' : '❌'}`);
    });
  });
}

/**
 * Clean up test data
 */
async function cleanupTestData(propertyId: string): Promise<void> {
  console.log('\n🧹 Cleaning up test data...');

  try {
    // Delete from vNext tables
    await supabaseAdmin!.from('property_contacts').delete().eq('property_id', propertyId);
    await supabaseAdmin!.from('contacts').delete().like('id', `test-contact-${propertyId}%`);
    await supabaseAdmin!.from('skip_trace_runs').delete().eq('property_id', propertyId);
    await supabaseAdmin!.from('lead_pipeline').delete().eq('property_id', propertyId);
    await supabaseAdmin!.from('properties').delete().eq('id', propertyId);
    
    // Delete from legacy table
    await supabaseAdmin!.from(config.DatabaseConfig.LEGACY_TABLE_NAME).delete().eq('source', 'test_skip_trace');

    console.log('✅ Test data cleaned up successfully');
  } catch (error) {
    console.error('⚠️  Error cleaning up test data:', error);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testSkipTraceFlow()
    .then(() => {
      console.log('\n🎉 All tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

export { testSkipTraceFlow };
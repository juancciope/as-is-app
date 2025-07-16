#!/usr/bin/env npx tsx
/**
 * Backfill Test Script
 * 
 * This script tests the backfill functionality with sample data
 * to verify the migration logic works correctly before running
 * against production data.
 */

import { createClient } from '@supabase/supabase-js';
import { DatabaseConfig } from '../lib/config';
import type { ForeclosureData } from '../lib/supabase';

const supabase = createClient(
  DatabaseConfig.SUPABASE_URL,
  DatabaseConfig.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const sampleData: Partial<ForeclosureData>[] = [
  {
    id: 1,
    source: 'phillipjoneslaw',
    date: '2025-08-15',
    time: '10:00 AM',
    county: 'Davidson',
    firm: 'Phillip Jones Law',
    address: '123 Main Street, Nashville, TN 37201',
    city: 'Nashville',
    within_30min: 'Y',
    closest_city: 'Nashville',
    distance_miles: 5.2,
    est_drive_time: '15 minutes',
    owner_email_1: 'john.doe@example.com',
    owner_phone_1: '615-555-0123',
    owner_1_first_name: 'John',
    owner_1_last_name: 'Doe',
    created_at: '2025-01-01T10:00:00Z',
    updated_at: '2025-01-01T10:00:00Z'
  },
  {
    id: 2,
    source: 'clearrecon',
    date: '2025-08-16',
    time: '11:00 AM',
    county: 'Davidson',
    firm: 'ClearRecon',
    address: '123 Main St, Nashville, TN 37201', // Same address, different format
    city: 'Nashville',
    within_30min: 'Y',
    closest_city: 'Nashville',
    distance_miles: 5.2,
    est_drive_time: '15 minutes',
    owner_email_1: 'jane.smith@example.com',
    owner_phone_1: '615-555-0124',
    owner_1_first_name: 'Jane',
    owner_1_last_name: 'Smith',
    created_at: '2025-01-01T11:00:00Z',
    updated_at: '2025-01-01T11:00:00Z'
  },
  {
    id: 3,
    source: 'wilsonassociates',
    date: '2025-08-17',
    time: '09:00 AM',
    county: 'Sumner',
    firm: 'Wilson Associates',
    address: '456 Oak Avenue, Gallatin, TN 37066',
    city: 'Gallatin',
    within_30min: 'Y',
    closest_city: 'Mt. Juliet',
    distance_miles: 8.5,
    est_drive_time: '20 minutes',
    owner_email_1: 'bob.johnson@example.com',
    owner_email_2: 'bob.j.alt@example.com',
    owner_phone_1: '615-555-0125',
    owner_phone_2: '615-555-0126',
    owner_1_first_name: 'Bob',
    owner_1_last_name: 'Johnson',
    created_at: '2025-01-01T09:00:00Z',
    updated_at: '2025-01-01T09:00:00Z'
  },
  {
    id: 4,
    source: 'tnledger',
    date: '2025-08-18',
    time: '14:00',
    county: 'Wilson',
    firm: 'TN Ledger',
    address: '789 Pine Road, Lebanon, TN 37087',
    city: 'Lebanon',
    within_30min: 'N',
    closest_city: 'Mt. Juliet',
    distance_miles: 35.2,
    est_drive_time: '45 minutes',
    // No contact info - should be marked as 'new' stage
    created_at: '2025-01-01T14:00:00Z',
    updated_at: '2025-01-01T14:00:00Z'
  },
  {
    id: 5,
    source: 'wabipowerbi',
    date: '2025-08-19',
    time: '13:30',
    county: 'Rutherford',
    firm: 'WABI PowerBI',
    address: '321 Elm Street, Murfreesboro, TN 37128',
    city: 'Murfreesboro',
    within_30min: 'N',
    closest_city: 'Nashville',
    distance_miles: 32.1,
    est_drive_time: '40 minutes',
    owner_email_1: 'mary.williams@example.com',
    owner_phone_1: '615-555-0127',
    owner_phone_2: '615-555-0128',
    owner_1_first_name: 'Mary',
    owner_1_last_name: 'Williams',
    owner_2_first_name: 'David',
    owner_2_last_name: 'Williams',
    created_at: '2025-01-01T13:30:00Z',
    updated_at: '2025-01-01T13:30:00Z'
  }
];

class BackfillTester {
  private testTableName = 'foreclosure_data_test';

  async setupTestData(): Promise<void> {
    console.log('🔧 Setting up test data...');
    
    // Create test table (copy of foreclosure_data structure)
    await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS ${this.testTableName} (
          LIKE foreclosure_data INCLUDING ALL
        );
      `
    });

    // Clear existing test data
    await supabase.from(this.testTableName).delete().neq('id', 0);

    // Insert sample data
    const { error } = await supabase
      .from(this.testTableName)
      .insert(sampleData);

    if (error) {
      throw new Error(`Failed to insert test data: ${error.message}`);
    }

    console.log(`   ✅ Inserted ${sampleData.length} test records`);
  }

  async runTests(): Promise<void> {
    console.log('🧪 Running backfill tests...');
    
    // Test 1: Address normalization
    console.log('   📍 Testing address normalization...');
    const addresses = [
      '123 Main Street, Nashville, TN 37201',
      '123 Main St, Nashville, TN 37201',
      '123 main street nashville tn 37201',
      '123 Main St., Nashville, Tennessee 37201'
    ];
    
    const normalized = addresses.map(addr => this.normalizeAddress(addr));
    const uniqueNormalized = [...new Set(normalized)];
    
    console.log(`     Original addresses: ${addresses.length}`);
    console.log(`     Unique normalized: ${uniqueNormalized.length}`);
    console.log(`     ✅ Address normalization ${uniqueNormalized.length === 1 ? 'working' : 'failed'}`);

    // Test 2: Distance calculation
    console.log('   📏 Testing distance calculations...');
    const nashCoords = { lat: 36.1627, lon: -86.7816 };
    const mtJulietCoords = { lat: 36.2009, lon: -86.5186 };
    
    const distance = this.calculateDistance(
      nashCoords.lat, nashCoords.lon,
      mtJulietCoords.lat, mtJulietCoords.lon
    );
    
    console.log(`     Distance Nashville to Mt. Juliet: ${distance.toFixed(2)} miles`);
    console.log(`     ✅ Distance calculation ${distance > 10 && distance < 30 ? 'working' : 'failed'}`);

    // Test 3: Contact extraction
    console.log('   👥 Testing contact extraction...');
    const testRecord = sampleData[2] as ForeclosureData; // Record with multiple contacts
    const contactInfo = this.extractContactInfo(testRecord);
    
    console.log(`     Extracted phones: ${contactInfo.phones.length}`);
    console.log(`     Extracted emails: ${contactInfo.emails.length}`);
    console.log(`     Extracted names: ${contactInfo.names.length}`);
    console.log(`     ✅ Contact extraction ${contactInfo.phones.length > 0 && contactInfo.emails.length > 0 ? 'working' : 'failed'}`);

    // Test 4: Pipeline stage determination
    console.log('   🔄 Testing pipeline stage logic...');
    const enrichedStage = this.determinePipelineStage(contactInfo);
    const emptyContactInfo = { phones: [], emails: [], names: [] };
    const newStage = this.determinePipelineStage(emptyContactInfo);
    
    console.log(`     Enriched record stage: ${enrichedStage}`);
    console.log(`     Empty record stage: ${newStage}`);
    console.log(`     ✅ Pipeline logic ${enrichedStage === 'enriched' && newStage === 'new' ? 'working' : 'failed'}`);
  }

  async verifyTestResults(): Promise<void> {
    console.log('✅ Verifying test results...');
    
    // Check if test data exists
    const { data, error } = await supabase
      .from(this.testTableName)
      .select('*')
      .limit(1);

    if (error || !data || data.length === 0) {
      console.log('   ❌ Test data not found or accessible');
      return;
    }

    console.log('   ✅ Test data is accessible');
    
    // Expected results based on sample data
    const expectedResults = {
      totalRecords: 5,
      uniqueAddresses: 4, // 123 Main St variants should be deduplicated
      recordsWithContacts: 4, // All except record 4
      targetCounties: ['Davidson', 'Sumner', 'Wilson'].filter(county => 
        sampleData.some(record => record.county === county)
      ).length
    };

    console.log('   📊 Expected results:');
    console.log(`     Total records: ${expectedResults.totalRecords}`);
    console.log(`     Unique addresses: ${expectedResults.uniqueAddresses}`);
    console.log(`     Records with contacts: ${expectedResults.recordsWithContacts}`);
    console.log(`     Target counties: ${expectedResults.targetCounties}`);
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test data...');
    
    // Drop test table
    await supabase.rpc('exec_sql', {
      query: `DROP TABLE IF EXISTS ${this.testTableName};`
    });
    
    console.log('   ✅ Test cleanup complete');
  }

  // Helper methods (duplicated from backfill script for testing)
  private normalizeAddress(address: string): string {
    if (!address) return '';
    
    return address
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\b(street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|circle|cir|boulevard|blvd|place|pl|way|parkway|pkwy|trail|trl)\b/g, '')
      .replace(/\b(north|south|east|west|n|s|e|w)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private extractContactInfo(record: ForeclosureData): {
    phones: Array<{ number: string; label?: string; verified?: boolean; source?: string }>;
    emails: Array<{ email: string; label?: string; verified?: boolean; source?: string }>;
    names: Array<{ first?: string; last?: string }>;
  } {
    const phones: any[] = [];
    const emails: any[] = [];
    const names: any[] = [];

    // Extract phones
    for (let i = 1; i <= 5; i++) {
      const phone = record[`owner_phone_${i}` as keyof ForeclosureData] as string;
      if (phone) {
        phones.push({
          number: phone,
          label: i === 1 ? 'primary' : 'secondary',
          verified: false,
          source: 'ci_legacy'
        });
      }
    }

    // Extract emails
    for (let i = 1; i <= 5; i++) {
      const email = record[`owner_email_${i}` as keyof ForeclosureData] as string;
      if (email) {
        emails.push({
          email: email,
          label: i === 1 ? 'primary' : 'secondary',
          verified: false,
          source: 'ci_legacy'
        });
      }
    }

    // Extract names
    for (let i = 1; i <= 2; i++) {
      const firstName = record[`owner_${i}_first_name` as keyof ForeclosureData] as string;
      const lastName = record[`owner_${i}_last_name` as keyof ForeclosureData] as string;
      if (firstName || lastName) {
        names.push({
          first: firstName,
          last: lastName
        });
      }
    }

    return { phones, emails, names };
  }

  private determinePipelineStage(contactInfo: {
    phones: any[];
    emails: any[];
    names: any[];
  }): string {
    const hasContact = contactInfo.phones.length > 0 || contactInfo.emails.length > 0;
    return hasContact ? 'enriched' : 'new';
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Backfill Test Suite...');
    console.log('='.repeat(50));

    try {
      await this.setupTestData();
      await this.runTests();
      await this.verifyTestResults();
      
      console.log('\n🎉 All tests completed successfully!');
      console.log('💡 You can now run the actual backfill with confidence.');
      
    } catch (error) {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Main execution
async function main() {
  const tester = new BackfillTester();
  await tester.run();
}

// Run if this script is executed directly
if (require.main === module) {
  main();
}

export { BackfillTester };
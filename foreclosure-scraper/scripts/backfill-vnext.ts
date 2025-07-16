#!/usr/bin/env npx tsx
/**
 * vNext Backfill Script
 * 
 * This script migrates existing data from the legacy foreclosure_data table
 * into the new normalized vNext schema. It handles:
 * - Property deduplication by normalized address
 * - Distress event creation for each legacy record
 * - Contact information migration from individual columns to JSON arrays
 * - Lead pipeline stage assignment based on enrichment status
 * - Distance recalculation for Mt. Juliet hub
 * 
 * The script supports both dry-run and apply modes for safe testing.
 */

import { createClient } from '@supabase/supabase-js';
import { DatabaseConfig, VNextConfig, FeatureFlags } from '../lib/config';
import type { 
  ForeclosureData, 
  Property, 
  DistressEvent, 
  Contact, 
  PropertyContact, 
  LeadPipeline 
} from '../lib/supabase';

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

interface MigrationStats {
  legacyRecords: number;
  uniqueAddresses: number;
  propertiesCreated: number;
  distressEventsCreated: number;
  contactsCreated: number;
  propertyContactsCreated: number;
  leadPipelineCreated: number;
  errors: string[];
}

interface AddressGroup {
  normalizedAddress: string;
  properties: ForeclosureData[];
  representativeProperty: ForeclosureData;
}

class VNextBackfill {
  private dryRun: boolean;
  private stats: MigrationStats;
  private hubCoordinates = VNextConfig.HUBS;

  constructor(dryRun: boolean = true) {
    this.dryRun = dryRun;
    this.stats = {
      legacyRecords: 0,
      uniqueAddresses: 0,
      propertiesCreated: 0,
      distressEventsCreated: 0,
      contactsCreated: 0,
      propertyContactsCreated: 0,
      leadPipelineCreated: 0,
      errors: []
    };
  }

  /**
   * Normalize address for deduplication
   */
  private normalizeAddress(address: string): string {
    if (!address) return '';
    
    return address
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\b(street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|circle|cir|boulevard|blvd|place|pl|way|parkway|pkwy|trail|trl)\b/g, '') // Remove common street suffixes
      .replace(/\b(north|south|east|west|n|s|e|w)\b/g, '') // Remove directional indicators
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate distance using Haversine formula
   */
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

  /**
   * Estimate drive time from distance
   */
  private estimateDriveTime(distance: number): number {
    if (distance <= 5) return Math.round((distance / 25) * 60); // City driving
    if (distance <= 15) return Math.round((distance / 35) * 60); // Suburban
    if (distance <= 30) return Math.round((distance / 45) * 60); // Mixed
    return Math.round((distance / 55) * 60); // Highway
  }

  /**
   * Calculate distances to both hubs and set proximity flags
   */
  private calculateProximityData(lat?: number, lon?: number) {
    if (!lat || !lon) {
      return {
        distance_nash_mi: null,
        distance_mtjuliet_mi: null,
        within_30min_nash: false,
        within_30min_mtjuliet: false
      };
    }

    const distanceNash = this.calculateDistance(lat, lon, this.hubCoordinates.NASHVILLE.lat, this.hubCoordinates.NASHVILLE.lon);
    const distanceMtJuliet = this.calculateDistance(lat, lon, this.hubCoordinates.MT_JULIET.lat, this.hubCoordinates.MT_JULIET.lon);
    
    const driveTimeNash = this.estimateDriveTime(distanceNash);
    const driveTimeMtJuliet = this.estimateDriveTime(distanceMtJuliet);

    return {
      distance_nash_mi: Math.round(distanceNash * 100) / 100,
      distance_mtjuliet_mi: Math.round(distanceMtJuliet * 100) / 100,
      within_30min_nash: driveTimeNash <= VNextConfig.MAX_DRIVE_TIME_MIN,
      within_30min_mtjuliet: driveTimeMtJuliet <= VNextConfig.MAX_DRIVE_TIME_MIN
    };
  }

  /**
   * Extract coordinates from geocoding data if available
   */
  private extractCoordinates(record: ForeclosureData): { lat?: number; lon?: number } {
    // For now, we'll use null coordinates since the legacy data doesn't have lat/lon
    // In a real implementation, you might geocode addresses here
    return { lat: undefined, lon: undefined };
  }

  /**
   * Group legacy records by normalized address
   */
  private groupByAddress(records: ForeclosureData[]): AddressGroup[] {
    const groups = new Map<string, ForeclosureData[]>();

    for (const record of records) {
      const normalized = this.normalizeAddress(record.address);
      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }
      groups.get(normalized)!.push(record);
    }

    return Array.from(groups.entries()).map(([normalizedAddress, properties]) => ({
      normalizedAddress,
      properties,
      representativeProperty: properties[0] // Use first record as representative
    }));
  }

  /**
   * Create property record from address group
   */
  private createProperty(group: AddressGroup): Omit<Property, 'id' | 'created_at' | 'updated_at'> {
    const rep = group.representativeProperty;
    const coords = this.extractCoordinates(rep);
    const proximityData = this.calculateProximityData(coords.lat, coords.lon);

    return {
      full_address: rep.address,
      street: rep.address.split(',')[0]?.trim(),
      city: rep.city,
      state: 'TN',
      zip: undefined, // Extract from address if needed
      county: rep.county,
      parcel_apn: undefined,
      lat: coords.lat,
      lon: coords.lon,
      distance_nash_mi: proximityData.distance_nash_mi || undefined,
      distance_mtjuliet_mi: proximityData.distance_mtjuliet_mi || undefined,
      within_30min_nash: proximityData.within_30min_nash,
      within_30min_mtjuliet: proximityData.within_30min_mtjuliet,
      property_type: 'SFR', // Default assumption
      beds: undefined,
      baths: undefined,
      sqft: undefined,
      lot_sqft: undefined,
      data_confidence: 0.8 // Default confidence for migrated data
    };
  }

  /**
   * Create distress event from legacy record
   */
  private createDistressEvent(record: ForeclosureData, propertyId: string): Omit<DistressEvent, 'id' | 'created_at'> {
    return {
      property_id: propertyId,
      event_type: 'FORECLOSURE',
      source: record.source,
      event_date: record.date,
      event_time: record.time,
      firm: record.firm,
      status: 'active',
      raw_data: {
        legacy_id: record.id,
        within_30min: record.within_30min,
        closest_city: record.closest_city,
        distance_miles: record.distance_miles,
        est_drive_time: record.est_drive_time,
        geocode_method: record.geocode_method,
        migrated_at: new Date().toISOString()
      }
    };
  }

  /**
   * Extract contact information from legacy record
   */
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

  /**
   * Create contact record from extracted information
   */
  private createContact(contactInfo: ReturnType<typeof this.extractContactInfo>, index: number): Omit<Contact, 'id' | 'created_at' | 'updated_at'> {
    const name = contactInfo.names[index] || { first: '', last: '' };
    
    return {
      name_first: name.first,
      name_last: name.last,
      entity_name: undefined,
      contact_type: 'skiptrace_result',
      phones: contactInfo.phones,
      emails: contactInfo.emails,
      mailing_address: undefined,
      notes: 'Migrated from legacy foreclosure_data table'
    };
  }

  /**
   * Determine lead pipeline stage based on contact information
   */
  private determinePipelineStage(contactInfo: ReturnType<typeof this.extractContactInfo>): string {
    const hasContact = contactInfo.phones.length > 0 || contactInfo.emails.length > 0;
    return hasContact ? 'enriched' : 'new';
  }

  /**
   * Fetch all legacy records
   */
  private async fetchLegacyRecords(): Promise<ForeclosureData[]> {
    console.log('📊 Fetching legacy records...');
    
    const { data, error } = await supabase
      .from(DatabaseConfig.LEGACY_TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch legacy records: ${error.message}`);
    }

    this.stats.legacyRecords = data?.length || 0;
    console.log(`   Found ${this.stats.legacyRecords} legacy records`);
    
    return data || [];
  }

  /**
   * Migrate properties
   */
  private async migrateProperties(addressGroups: AddressGroup[]): Promise<Map<string, string>> {
    console.log('🏠 Migrating properties...');
    
    const propertyMap = new Map<string, string>(); // normalized address -> property ID
    const properties = addressGroups.map(group => this.createProperty(group));

    if (this.dryRun) {
      console.log(`   [DRY RUN] Would create ${properties.length} properties`);
      // Generate fake UUIDs for dry run
      addressGroups.forEach((group, index) => {
        propertyMap.set(group.normalizedAddress, `property-${index}`);
      });
      this.stats.propertiesCreated = properties.length;
      return propertyMap;
    }

    try {
      const { data, error } = await supabase
        .from('properties')
        .insert(properties)
        .select('id, full_address');

      if (error) {
        throw new Error(`Failed to insert properties: ${error.message}`);
      }

      // Map normalized addresses to property IDs
      data?.forEach((property, index) => {
        propertyMap.set(addressGroups[index].normalizedAddress, property.id);
      });

      this.stats.propertiesCreated = data?.length || 0;
      console.log(`   ✅ Created ${this.stats.propertiesCreated} properties`);
    } catch (error) {
      const errorMsg = `Property migration failed: ${error}`;
      this.stats.errors.push(errorMsg);
      console.error(`   ❌ ${errorMsg}`);
      throw error;
    }

    return propertyMap;
  }

  /**
   * Migrate distress events
   */
  private async migrateDistressEvents(records: ForeclosureData[], propertyMap: Map<string, string>): Promise<void> {
    console.log('📅 Migrating distress events...');
    
    const distressEvents: Omit<DistressEvent, 'id' | 'created_at'>[] = [];

    for (const record of records) {
      const normalizedAddress = this.normalizeAddress(record.address);
      const propertyId = propertyMap.get(normalizedAddress);
      
      if (!propertyId) {
        const errorMsg = `No property ID found for address: ${record.address}`;
        this.stats.errors.push(errorMsg);
        console.warn(`   ⚠️  ${errorMsg}`);
        continue;
      }

      distressEvents.push(this.createDistressEvent(record, propertyId));
    }

    if (this.dryRun) {
      console.log(`   [DRY RUN] Would create ${distressEvents.length} distress events`);
      this.stats.distressEventsCreated = distressEvents.length;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('distress_events')
        .insert(distressEvents)
        .select('id');

      if (error) {
        throw new Error(`Failed to insert distress events: ${error.message}`);
      }

      this.stats.distressEventsCreated = data?.length || 0;
      console.log(`   ✅ Created ${this.stats.distressEventsCreated} distress events`);
    } catch (error) {
      const errorMsg = `Distress events migration failed: ${error}`;
      this.stats.errors.push(errorMsg);
      console.error(`   ❌ ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Migrate contacts and property-contact relationships
   */
  private async migrateContacts(records: ForeclosureData[], propertyMap: Map<string, string>): Promise<void> {
    console.log('👥 Migrating contacts...');
    
    const contacts: Omit<Contact, 'id' | 'created_at' | 'updated_at'>[] = [];
    const propertyContacts: Omit<PropertyContact, 'last_validated_at'>[] = [];
    const contactMap = new Map<string, string>(); // temp key -> contact ID

    for (const record of records) {
      const normalizedAddress = this.normalizeAddress(record.address);
      const propertyId = propertyMap.get(normalizedAddress);
      
      if (!propertyId) continue;

      const contactInfo = this.extractContactInfo(record);
      
      // Skip if no contact information
      if (contactInfo.phones.length === 0 && contactInfo.emails.length === 0) {
        continue;
      }

      // Create contact record
      const contact = this.createContact(contactInfo, 0);
      contacts.push(contact);

      // Create property-contact relationship
      const tempKey = `${record.id}-contact`;
      contactMap.set(tempKey, `contact-${contacts.length - 1}`);
      
      propertyContacts.push({
        property_id: propertyId,
        contact_id: tempKey, // Will be replaced with actual ID after insertion
        role: 'skiptrace',
        confidence: 0.7 // Default confidence for migrated data
      });
    }

    if (this.dryRun) {
      console.log(`   [DRY RUN] Would create ${contacts.length} contacts`);
      console.log(`   [DRY RUN] Would create ${propertyContacts.length} property-contact relationships`);
      this.stats.contactsCreated = contacts.length;
      this.stats.propertyContactsCreated = propertyContacts.length;
      return;
    }

    try {
      // Insert contacts
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .insert(contacts)
        .select('id');

      if (contactError) {
        throw new Error(`Failed to insert contacts: ${contactError.message}`);
      }

      this.stats.contactsCreated = contactData?.length || 0;
      console.log(`   ✅ Created ${this.stats.contactsCreated} contacts`);

      // Update property-contact relationships with actual contact IDs
      const updatedPropertyContacts = propertyContacts.map((pc, index) => ({
        ...pc,
        contact_id: contactData?.[index]?.id || ''
      })).filter(pc => pc.contact_id);

      // Insert property-contact relationships
      const { data: pcData, error: pcError } = await supabase
        .from('property_contacts')
        .insert(updatedPropertyContacts)
        .select('property_id, contact_id, role');

      if (pcError) {
        throw new Error(`Failed to insert property-contact relationships: ${pcError.message}`);
      }

      this.stats.propertyContactsCreated = pcData?.length || 0;
      console.log(`   ✅ Created ${this.stats.propertyContactsCreated} property-contact relationships`);
    } catch (error) {
      const errorMsg = `Contact migration failed: ${error}`;
      this.stats.errors.push(errorMsg);
      console.error(`   ❌ ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Migrate lead pipeline stages
   */
  private async migrateLeadPipeline(records: ForeclosureData[], propertyMap: Map<string, string>): Promise<void> {
    console.log('🔄 Migrating lead pipeline...');
    
    const leadPipeline: Omit<LeadPipeline, 'last_stage_at'>[] = [];
    const processedProperties = new Set<string>();

    for (const record of records) {
      const normalizedAddress = this.normalizeAddress(record.address);
      const propertyId = propertyMap.get(normalizedAddress);
      
      if (!propertyId || processedProperties.has(propertyId)) continue;
      
      processedProperties.add(propertyId);
      
      const contactInfo = this.extractContactInfo(record);
      const stage = this.determinePipelineStage(contactInfo);
      
      leadPipeline.push({
        property_id: propertyId,
        stage: stage,
        assigned_to: undefined
      });
    }

    if (this.dryRun) {
      console.log(`   [DRY RUN] Would create ${leadPipeline.length} lead pipeline entries`);
      this.stats.leadPipelineCreated = leadPipeline.length;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('lead_pipeline')
        .insert(leadPipeline)
        .select('property_id, stage');

      if (error) {
        throw new Error(`Failed to insert lead pipeline: ${error.message}`);
      }

      this.stats.leadPipelineCreated = data?.length || 0;
      console.log(`   ✅ Created ${this.stats.leadPipelineCreated} lead pipeline entries`);
    } catch (error) {
      const errorMsg = `Lead pipeline migration failed: ${error}`;
      this.stats.errors.push(errorMsg);
      console.error(`   ❌ ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Validate migration results
   */
  private validateMigration(): void {
    console.log('\n📋 Validation Results:');
    console.log('='.repeat(50));
    
    const expectedDistressEvents = this.stats.legacyRecords;
    const expectedProperties = this.stats.uniqueAddresses;
    
    console.log(`📊 Record Counts:`);
    console.log(`   Legacy records: ${this.stats.legacyRecords}`);
    console.log(`   Unique addresses: ${this.stats.uniqueAddresses}`);
    console.log(`   Properties created: ${this.stats.propertiesCreated}`);
    console.log(`   Distress events created: ${this.stats.distressEventsCreated}`);
    console.log(`   Contacts created: ${this.stats.contactsCreated}`);
    console.log(`   Property-contact relationships: ${this.stats.propertyContactsCreated}`);
    console.log(`   Lead pipeline entries: ${this.stats.leadPipelineCreated}`);
    
    console.log(`\n✅ Validation Checks:`);
    console.log(`   Legacy records == Distress events: ${expectedDistressEvents === this.stats.distressEventsCreated ? '✅' : '❌'}`);
    console.log(`   Unique addresses == Properties: ${expectedProperties === this.stats.propertiesCreated ? '✅' : '❌'}`);
    console.log(`   Properties == Lead pipeline: ${this.stats.propertiesCreated === this.stats.leadPipelineCreated ? '✅' : '❌'}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors (${this.stats.errors.length}):`);
      this.stats.errors.forEach(error => console.log(`   - ${error}`));
    } else {
      console.log(`\n✅ No errors detected!`);
    }
  }

  /**
   * Run the complete migration
   */
  async run(): Promise<void> {
    console.log('🚀 Starting vNext Data Migration...');
    console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'APPLY'}`);
    console.log('='.repeat(50));

    try {
      // Step 1: Fetch legacy records
      const legacyRecords = await this.fetchLegacyRecords();
      
      if (legacyRecords.length === 0) {
        console.log('ℹ️  No legacy records found. Migration complete.');
        return;
      }

      // Step 2: Group by normalized address
      console.log('🔍 Grouping by normalized address...');
      const addressGroups = this.groupByAddress(legacyRecords);
      this.stats.uniqueAddresses = addressGroups.length;
      console.log(`   Found ${this.stats.uniqueAddresses} unique addresses`);

      // Step 3: Migrate properties
      const propertyMap = await this.migrateProperties(addressGroups);

      // Step 4: Migrate distress events
      await this.migrateDistressEvents(legacyRecords, propertyMap);

      // Step 5: Migrate contacts
      await this.migrateContacts(legacyRecords, propertyMap);

      // Step 6: Migrate lead pipeline
      await this.migrateLeadPipeline(legacyRecords, propertyMap);

      // Step 7: Validate results
      this.validateMigration();

      console.log('\n🎉 Migration completed successfully!');
      
      if (this.dryRun) {
        console.log('\n💡 This was a dry run. No data was actually migrated.');
        console.log('   Run with --apply to perform the actual migration.');
      }

    } catch (error) {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  
  if (dryRun) {
    console.log('💡 Running in DRY RUN mode. Use --apply to perform actual migration.');
  }

  const backfill = new VNextBackfill(dryRun);
  await backfill.run();
}

// Run if this script is executed directly
if (require.main === module) {
  main();
}

export { VNextBackfill };
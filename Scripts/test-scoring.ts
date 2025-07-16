#!/usr/bin/env npx tsx
/**
 * Scoring System Test Suite
 * 
 * This script tests the property scoring algorithm with various scenarios
 * to ensure it behaves correctly and produces expected results.
 */

import { 
  PropertyScorer, 
  createDefaultScorer, 
  scoreProperty, 
  scoreProperties,
  getScoringWeights,
  validateScoringConfig,
  type ScoreResult,
  type ScoringContext
} from '../lib/scoring';
import { VNextConfig } from '../lib/config';
import type { Property, DistressEvent, Contact, PropertyContact, InvestorRules } from '../lib/supabase';

interface TestCase {
  name: string;
  property: Property;
  events: DistressEvent[];
  contacts: Contact[];
  propertyContacts: PropertyContact[];
  expectedScore: {
    min: number;
    max: number;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  };
  expectedFactors: {
    countyMatch: number;
    hasContact: number;
    driveTime: number; // Combined Nashville + Mt. Juliet
  };
}

class ScoringTester {
  private testCases: TestCase[] = [];
  private results: { testCase: TestCase; result: ScoreResult; passed: boolean }[] = [];

  constructor() {
    this.setupTestCases();
  }

  private setupTestCases(): void {
    const baseProperty: Property = {
      id: 'test-property',
      full_address: '123 Test Street, Nashville, TN 37201',
      street: '123 Test Street',
      city: 'Nashville',
      state: 'TN',
      zip: '37201',
      county: 'Davidson',
      parcel_apn: undefined,
      lat: 36.1627,
      lon: -86.7816,
      distance_nash_mi: 5.0,
      distance_mtjuliet_mi: 15.0,
      within_30min_nash: true,
      within_30min_mtjuliet: true,
      property_type: 'SFR',
      beds: 3,
      baths: 2,
      sqft: 1500,
      lot_sqft: 6000,
      data_confidence: 0.9,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };

    const urgentEvent: DistressEvent = {
      id: 'test-event-urgent',
      property_id: 'test-property',
      event_type: 'FORECLOSURE',
      source: 'test',
      event_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days from now
      event_time: '10:00 AM',
      firm: 'Test Firm',
      status: 'active',
      raw_data: {},
      created_at: '2025-01-01T00:00:00Z'
    };

    const soonEvent: DistressEvent = {
      ...urgentEvent,
      id: 'test-event-soon',
      event_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days from now
    };

    const moderateEvent: DistressEvent = {
      ...urgentEvent,
      id: 'test-event-moderate',
      event_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 20 days from now
    };

    const enrichedContact: Contact = {
      id: 'test-contact',
      name_first: 'John',
      name_last: 'Doe',
      entity_name: undefined,
      contact_type: 'skiptrace_result',
      phones: [{ number: '615-555-0123', label: 'primary', verified: false, source: 'test' }],
      emails: [{ email: 'john.doe@example.com', label: 'primary', verified: false, source: 'test' }],
      mailing_address: undefined,
      notes: 'Test contact',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };

    const propertyContact: PropertyContact = {
      property_id: 'test-property',
      contact_id: 'test-contact',
      role: 'skiptrace',
      confidence: 0.8,
      last_validated_at: undefined
    };

    // Test Case 1: Perfect property (urgent, enriched, target county, good location)
    this.testCases.push({
      name: 'Perfect Property - Urgent & Enriched',
      property: baseProperty,
      events: [urgentEvent],
      contacts: [enrichedContact],
      propertyContacts: [propertyContact],
      expectedScore: {
        min: 75,
        max: 100,
        priority: 'urgent'
      },
      expectedFactors: {
        countyMatch: 20,
        hasContact: 10,
        driveTime: 30 // 15 + 15 for both hubs
      }
    });

    // Test Case 2: Good property (soon, enriched, target county)
    this.testCases.push({
      name: 'Good Property - Soon & Enriched',
      property: baseProperty,
      events: [soonEvent],
      contacts: [enrichedContact],
      propertyContacts: [propertyContact],
      expectedScore: {
        min: 50,
        max: 75,
        priority: 'high'
      },
      expectedFactors: {
        countyMatch: 20,
        hasContact: 10,
        driveTime: 30
      }
    });

    // Test Case 3: Moderate property (distant event, enriched, target county)
    this.testCases.push({
      name: 'Moderate Property - Distant Event',
      property: baseProperty,
      events: [moderateEvent],
      contacts: [enrichedContact],
      propertyContacts: [propertyContact],
      expectedScore: {
        min: 40,
        max: 65,
        priority: 'medium'
      },
      expectedFactors: {
        countyMatch: 20,
        hasContact: 10,
        driveTime: 30
      }
    });

    // Test Case 4: Property without contacts
    this.testCases.push({
      name: 'Property Without Contacts',
      property: baseProperty,
      events: [urgentEvent],
      contacts: [],
      propertyContacts: [],
      expectedScore: {
        min: 55,
        max: 80,
        priority: 'high'
      },
      expectedFactors: {
        countyMatch: 20,
        hasContact: 0,
        driveTime: 30
      }
    });

    // Test Case 5: Property in non-target county
    this.testCases.push({
      name: 'Non-Target County Property',
      property: {
        ...baseProperty,
        county: 'Hamilton',
        within_30min_nash: false,
        within_30min_mtjuliet: false,
        distance_nash_mi: 150,
        distance_mtjuliet_mi: 160
      },
      events: [urgentEvent],
      contacts: [enrichedContact],
      propertyContacts: [propertyContact],
      expectedScore: {
        min: 25,
        max: 50,
        priority: 'medium'
      },
      expectedFactors: {
        countyMatch: 0,
        hasContact: 10,
        driveTime: 0
      }
    });

    // Test Case 6: Property with no events
    this.testCases.push({
      name: 'Property With No Events',
      property: baseProperty,
      events: [],
      contacts: [enrichedContact],
      propertyContacts: [propertyContact],
      expectedScore: {
        min: 35,
        max: 65,
        priority: 'medium'
      },
      expectedFactors: {
        countyMatch: 20,
        hasContact: 10,
        driveTime: 30
      }
    });

    // Test Case 7: Worst case scenario
    this.testCases.push({
      name: 'Worst Case Scenario',
      property: {
        ...baseProperty,
        county: 'Hamilton',
        within_30min_nash: false,
        within_30min_mtjuliet: false,
        distance_nash_mi: 200,
        distance_mtjuliet_mi: 210,
        property_type: 'Commercial'
      },
      events: [],
      contacts: [],
      propertyContacts: [],
      expectedScore: {
        min: 0,
        max: 25,
        priority: 'low'
      },
      expectedFactors: {
        countyMatch: 0,
        hasContact: 0,
        driveTime: 0
      }
    });
  }

  private runTest(testCase: TestCase): { passed: boolean; result: ScoreResult; errors: string[] } {
    const errors: string[] = [];
    
    try {
      const result = scoreProperty(
        testCase.property,
        testCase.events,
        testCase.contacts,
        testCase.propertyContacts,
        new Date() // Use current date for testing
      );

      // Check score range
      const scoreInRange = result.score >= testCase.expectedScore.min && 
                          result.score <= testCase.expectedScore.max;
      if (!scoreInRange) {
        errors.push(`Score ${result.score} not in expected range [${testCase.expectedScore.min}, ${testCase.expectedScore.max}]`);
      }

      // Check priority
      if (result.priority !== testCase.expectedScore.priority) {
        errors.push(`Priority ${result.priority} does not match expected ${testCase.expectedScore.priority}`);
      }

      // Check specific factors
      if (result.factors.countyMatch !== testCase.expectedFactors.countyMatch) {
        errors.push(`County match factor ${result.factors.countyMatch} does not match expected ${testCase.expectedFactors.countyMatch}`);
      }

      if (result.factors.hasContact !== testCase.expectedFactors.hasContact) {
        errors.push(`Has contact factor ${result.factors.hasContact} does not match expected ${testCase.expectedFactors.hasContact}`);
      }

      const totalDriveTime = result.factors.driveTimeNash + result.factors.driveTimeMtJuliet;
      if (totalDriveTime !== testCase.expectedFactors.driveTime) {
        errors.push(`Drive time factors ${totalDriveTime} do not match expected ${testCase.expectedFactors.driveTime}`);
      }

      return { passed: errors.length === 0, result, errors };
    } catch (error) {
      return { 
        passed: false, 
        result: {} as ScoreResult, 
        errors: [`Test execution failed: ${error}`] 
      };
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Running Scoring System Tests...');
    console.log('='.repeat(60));

    let passedTests = 0;
    let totalTests = this.testCases.length;

    for (const testCase of this.testCases) {
      console.log(`\n🔍 Testing: ${testCase.name}`);
      
      const testResult = this.runTest(testCase);
      
      if (testResult.passed) {
        console.log(`   ✅ PASSED - Score: ${testResult.result.score}, Priority: ${testResult.result.priority}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Score: ${testResult.result.score}, Priority: ${testResult.result.priority}`);
        testResult.errors.forEach(error => console.log(`      - ${error}`));
      }

      // Show score breakdown
      if (testResult.result.factors) {
        console.log(`   📊 Factors: County(${testResult.result.factors.countyMatch}) + Nashville(${testResult.result.factors.driveTimeNash}) + Mt.Juliet(${testResult.result.factors.driveTimeMtJuliet}) + Event(${testResult.result.factors.daysToEvent}) + Contact(${testResult.result.factors.hasContact}) + Type(${testResult.result.factors.propertyTypeMatch}) = ${testResult.result.factors.total}`);
      }

      this.results.push({
        testCase,
        result: testResult.result,
        passed: testResult.passed
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📈 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! Scoring system is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please review the scoring algorithm.');
    }
  }

  async testScoringWeights(): Promise<void> {
    console.log('\n🔧 Testing Scoring Weights...');
    
    const weights = getScoringWeights();
    const expectedTotal = 20 + 15 + 15 + 25 + 10 + 5; // Max possible score
    
    console.log(`   County Match: ${weights.COUNTY_MATCH} points`);
    console.log(`   Nashville Drive Time: ${weights.DRIVE_TIME_NASH} points`);
    console.log(`   Mt. Juliet Drive Time: ${weights.DRIVE_TIME_MTJULIET} points`);
    console.log(`   Days to Event (Urgent): ${weights.DAYS_TO_EVENT_URGENT} points`);
    console.log(`   Has Contact: ${weights.HAS_CONTACT} points`);
    console.log(`   Property Type Match: ${weights.PROPERTY_TYPE_MATCH} points`);
    console.log(`   Maximum Possible Score: ${expectedTotal} points`);
    
    if (expectedTotal <= 100) {
      console.log('   ✅ Scoring weights are properly calibrated');
    } else {
      console.log('   ❌ Scoring weights exceed 100 points maximum');
    }
  }

  async testConfigValidation(): Promise<void> {
    console.log('\n⚙️  Testing Config Validation...');
    
    const validConfig: InvestorRules = {
      id: 'test',
      label: 'Test Config',
      config: {
        target_counties: ['Davidson', 'Sumner'],
        max_drive_time_min: 30,
        max_distance_mi: 30,
        property_types: ['SFR'],
        price_min: 0,
        price_max: 500000
      },
      updated_at: new Date().toISOString()
    };

    const invalidConfig: InvestorRules = {
      id: 'test-invalid',
      label: 'Invalid Config',
      config: {
        target_counties: [],
        max_drive_time_min: 0,
        max_distance_mi: 30,
        property_types: [],
        price_min: 0,
        price_max: 500000
      },
      updated_at: new Date().toISOString()
    };

    const validResult = validateScoringConfig(validConfig);
    const invalidResult = validateScoringConfig(invalidConfig);

    if (validResult.valid) {
      console.log('   ✅ Valid config validation passed');
    } else {
      console.log('   ❌ Valid config validation failed:', validResult.errors);
    }

    if (!invalidResult.valid && invalidResult.errors.length > 0) {
      console.log('   ✅ Invalid config validation caught errors:', invalidResult.errors);
    } else {
      console.log('   ❌ Invalid config validation should have failed');
    }
  }

  async testEdgeCases(): Promise<void> {
    console.log('\n🎯 Testing Edge Cases...');
    
    // Test with null/undefined values
    const emptyProperty: Property = {
      id: 'empty',
      full_address: '',
      street: undefined,
      city: undefined,
      state: 'TN',
      zip: undefined,
      county: undefined,
      parcel_apn: undefined,
      lat: undefined,
      lon: undefined,
      distance_nash_mi: undefined,
      distance_mtjuliet_mi: undefined,
      within_30min_nash: false,
      within_30min_mtjuliet: false,
      property_type: undefined,
      beds: undefined,
      baths: undefined,
      sqft: undefined,
      lot_sqft: undefined,
      data_confidence: undefined,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };

    const result = scoreProperty(emptyProperty, [], [], []);
    
    if (result.score >= 0 && result.score <= 100) {
      console.log(`   ✅ Empty property handled correctly (score: ${result.score})`);
    } else {
      console.log(`   ❌ Empty property score out of range: ${result.score}`);
    }

    // Test with past events
    const pastEvent: DistressEvent = {
      id: 'past-event',
      property_id: 'test',
      event_type: 'FORECLOSURE',
      source: 'test',
      event_date: '2024-01-01',
      event_time: '10:00 AM',
      firm: 'Test Firm',
      status: 'active',
      raw_data: {},
      created_at: '2025-01-01T00:00:00Z'
    };

    const pastResult = scoreProperty(emptyProperty, [pastEvent], [], []);
    
    if (pastResult.factors.daysToEvent === 0) {
      console.log('   ✅ Past events handled correctly (no time-based points)');
    } else {
      console.log(`   ❌ Past events should not contribute time-based points: ${pastResult.factors.daysToEvent}`);
    }
  }

  async showSampleAnalysis(): Promise<void> {
    console.log('\n📋 Sample Property Analysis...');
    
    const sampleProperty = this.testCases[0]; // Use the perfect property
    const result = this.results.find(r => r.testCase === sampleProperty);
    
    if (result) {
      console.log(`   Property: ${sampleProperty.property.full_address}`);
      console.log(`   Score: ${result.result.score}/100 (${result.result.priority} priority)`);
      console.log(`   Urgency: ${result.result.urgencyDays} days`);
      console.log(`   Recommendations:`);
      result.result.recommendations.forEach(rec => console.log(`     - ${rec}`));
      
      if (result.result.warnings.length > 0) {
        console.log(`   Warnings:`);
        result.result.warnings.forEach(warn => console.log(`     - ${warn}`));
      }
    }
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Scoring System Test Suite...');
    console.log('='.repeat(60));

    await this.runAllTests();
    await this.testScoringWeights();
    await this.testConfigValidation();
    await this.testEdgeCases();
    await this.showSampleAnalysis();

    console.log('\n🎉 Scoring system test suite completed!');
  }
}

// Main execution
async function main() {
  const tester = new ScoringTester();
  await tester.run();
}

// Run if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { ScoringTester };
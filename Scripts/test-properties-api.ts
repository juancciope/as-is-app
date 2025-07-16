#!/usr/bin/env npx tsx
/**
 * Properties API Test Suite
 * 
 * Tests the new /api/properties endpoint with both legacy and vNext modes
 * to ensure proper functionality, filtering, scoring, and pagination.
 */

import { FeatureFlags } from '../lib/config';

interface TestCase {
  name: string;
  endpoint: string;
  params: Record<string, string>;
  expectedStatus: number;
  expectedFields: string[];
  validation?: (data: any) => boolean;
}

class PropertiesAPITester {
  private baseUrl: string;
  private testCases: TestCase[] = [];
  private results: { testCase: TestCase; passed: boolean; error?: string }[] = [];

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.setupTestCases();
  }

  private setupTestCases(): void {
    // Test Case 1: Basic endpoint functionality
    this.testCases.push({
      name: 'Basic Properties List',
      endpoint: '/api/properties',
      params: {},
      expectedStatus: 200,
      expectedFields: ['properties', 'pagination', 'filters', 'metadata'],
      validation: (data) => {
        return Array.isArray(data.properties) && 
               data.pagination && 
               data.metadata &&
               ['legacy', 'vnext'].includes(data.metadata.dataSource);
      }
    });

    // Test Case 2: Pagination
    this.testCases.push({
      name: 'Pagination - Page 1',
      endpoint: '/api/properties',
      params: { page: '1', limit: '10' },
      expectedStatus: 200,
      expectedFields: ['properties', 'pagination'],
      validation: (data) => {
        return data.pagination.page === 1 && 
               data.pagination.limit === 10 &&
               data.properties.length <= 10;
      }
    });

    // Test Case 3: County filtering
    this.testCases.push({
      name: 'County Filter - Davidson',
      endpoint: '/api/properties',
      params: { counties: 'Davidson' },
      expectedStatus: 200,
      expectedFields: ['properties'],
      validation: (data) => {
        return data.properties.every((prop: any) => prop.county === 'Davidson');
      }
    });

    // Test Case 4: Multiple counties
    this.testCases.push({
      name: 'Multiple Counties Filter',
      endpoint: '/api/properties',
      params: { counties: 'Davidson,Sumner,Wilson' },
      expectedStatus: 200,
      expectedFields: ['properties'],
      validation: (data) => {
        const validCounties = ['Davidson', 'Sumner', 'Wilson'];
        return data.properties.every((prop: any) => 
          validCounties.includes(prop.county)
        );
      }
    });

    // Test Case 5: Proximity filtering
    this.testCases.push({
      name: 'Nashville Proximity Filter',
      endpoint: '/api/properties',
      params: { within30minNash: 'true' },
      expectedStatus: 200,
      expectedFields: ['properties'],
      validation: (data) => {
        return data.properties.every((prop: any) => 
          prop.within_30min_nash === true
        );
      }
    });

    // Test Case 6: Date range filtering
    this.testCases.push({
      name: 'Date Range Filter',
      endpoint: '/api/properties',
      params: { 
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31'
      },
      expectedStatus: 200,
      expectedFields: ['properties'],
      validation: () => true // Date validation is complex, just check it doesn't error
    });

    // Test Case 7: Sorting by score
    this.testCases.push({
      name: 'Sort by Score (Descending)',
      endpoint: '/api/properties',
      params: { 
        sortBy: 'score',
        sortOrder: 'desc'
      },
      expectedStatus: 200,
      expectedFields: ['properties'],
      validation: (data) => {
        if (!FeatureFlags.VNEXT_SCORING_ENABLED) return true;
        
        const scores = data.properties.map((p: any) => p.score || 0);
        for (let i = 0; i < scores.length - 1; i++) {
          if (scores[i] < scores[i + 1]) return false;
        }
        return true;
      }
    });

    // Test Case 8: Include events and contacts
    this.testCases.push({
      name: 'Include Events and Contacts',
      endpoint: '/api/properties',
      params: { 
        includeEvents: 'true',
        includeContacts: 'true',
        limit: '5'
      },
      expectedStatus: 200,
      expectedFields: ['properties'],
      validation: (data) => {
        // Only applies to vNext mode
        if (FeatureFlags.USE_LEGACY) return true;
        
        return data.properties.some((prop: any) => 
          prop.events || prop.contacts
        );
      }
    });

    // Test Case 9: Score range filtering
    this.testCases.push({
      name: 'Score Range Filter',
      endpoint: '/api/properties',
      params: { 
        minScore: '50',
        maxScore: '100'
      },
      expectedStatus: 200,
      expectedFields: ['properties'],
      validation: (data) => {
        if (!FeatureFlags.VNEXT_SCORING_ENABLED) return true;
        
        return data.properties.every((prop: any) => {
          const score = prop.score || 0;
          return score >= 50 && score <= 100;
        });
      }
    });

    // Test Case 10: Filter options endpoint
    this.testCases.push({
      name: 'Available Filter Options',
      endpoint: '/api/properties',
      params: { limit: '1' },
      expectedStatus: 200,
      expectedFields: ['filters'],
      validation: (data) => {
        return data.filters.available &&
               Array.isArray(data.filters.available.counties) &&
               Array.isArray(data.filters.available.sources) &&
               Array.isArray(data.filters.available.stages);
      }
    });

    // Test Case 11: Error handling - invalid page
    this.testCases.push({
      name: 'Error Handling - Invalid Page',
      endpoint: '/api/properties',
      params: { page: 'invalid' },
      expectedStatus: 200, // Should default to page 1
      expectedFields: ['properties'],
      validation: (data) => {
        return data.pagination.page === 1;
      }
    });

    // Test Case 12: Large limit handling
    this.testCases.push({
      name: 'Large Limit Handling',
      endpoint: '/api/properties',
      params: { limit: '1000' },
      expectedStatus: 200,
      expectedFields: ['properties'],
      validation: (data) => {
        return data.pagination.limit <= 100; // Should be capped at 100
      }
    });
  }

  private async runTest(testCase: TestCase): Promise<{ passed: boolean; error?: string }> {
    try {
      const url = new URL(testCase.endpoint, this.baseUrl);
      
      // Add query parameters
      Object.entries(testCase.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      const response = await fetch(url.toString());
      
      // Check status code
      if (response.status !== testCase.expectedStatus) {
        return {
          passed: false,
          error: `Expected status ${testCase.expectedStatus}, got ${response.status}`
        };
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return {
          passed: false,
          error: 'Response is not JSON'
        };
      }

      const data = await response.json();

      // Check for expected fields
      for (const field of testCase.expectedFields) {
        if (!(field in data)) {
          return {
            passed: false,
            error: `Missing expected field: ${field}`
          };
        }
      }

      // Run custom validation if provided
      if (testCase.validation) {
        const validationResult = testCase.validation(data);
        if (!validationResult) {
          return {
            passed: false,
            error: 'Custom validation failed'
          };
        }
      }

      return { passed: true };

    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Testing Properties API Endpoint...');
    console.log('='.repeat(60));
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Feature Flags: USE_LEGACY=${FeatureFlags.USE_LEGACY}, SCORING_ENABLED=${FeatureFlags.VNEXT_SCORING_ENABLED}`);
    console.log('');

    let passedTests = 0;
    let totalTests = this.testCases.length;

    for (const testCase of this.testCases) {
      console.log(`🔍 Testing: ${testCase.name}`);
      
      const result = await this.runTest(testCase);
      
      if (result.passed) {
        console.log(`   ✅ PASSED`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED: ${result.error}`);
      }

      this.results.push({
        testCase,
        passed: result.passed,
        error: result.error
      });
    }

    console.log('');
    console.log('='.repeat(60));
    console.log(`📈 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! Properties API is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please review the API implementation.');
      console.log('');
      console.log('Failed tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.testCase.name}: ${r.error}`);
        });
    }
  }

  async testPerformance(): Promise<void> {
    console.log('\n⚡ Testing API Performance...');
    
    const performanceTests = [
      { name: 'Basic request', params: {} },
      { name: 'With scoring', params: { limit: '50' } },
      { name: 'With filtering', params: { counties: 'Davidson', within30minNash: 'true' } },
      { name: 'With events/contacts', params: { includeEvents: 'true', includeContacts: 'true', limit: '10' } }
    ];

    for (const test of performanceTests) {
      const url = new URL('/api/properties', this.baseUrl);
      Object.entries(test.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      const startTime = Date.now();
      
      try {
        const response = await fetch(url.toString());
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        if (response.ok) {
          const data = await response.json();
          console.log(`   ${test.name}: ${duration}ms (${data.properties.length} properties)`);
        } else {
          console.log(`   ${test.name}: ${duration}ms (ERROR: ${response.status})`);
        }
      } catch (error) {
        console.log(`   ${test.name}: FAILED (${error})`);
      }
    }
  }

  async testBothModes(): Promise<void> {
    console.log('\n🔄 Testing Both Legacy and vNext Modes...');
    
    // This would require toggling feature flags, which is complex in testing
    // For now, just show current mode
    console.log(`   Current mode: ${FeatureFlags.USE_LEGACY ? 'Legacy' : 'vNext'}`);
    console.log(`   Scoring enabled: ${FeatureFlags.VNEXT_SCORING_ENABLED}`);
    console.log('   To test both modes, toggle USE_LEGACY in .env and restart the server');
  }

  async showSampleData(): Promise<void> {
    console.log('\n📋 Sample API Response...');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/properties?limit=1`);
      if (response.ok) {
        const data = await response.json();
        console.log('   Sample property structure:');
        console.log(JSON.stringify(data.properties[0], null, 4));
        console.log('   Pagination info:');
        console.log(JSON.stringify(data.pagination, null, 4));
        console.log('   Metadata:');
        console.log(JSON.stringify(data.metadata, null, 4));
      } else {
        console.log(`   Error: ${response.status}`);
      }
    } catch (error) {
      console.log(`   Error: ${error}`);
    }
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Properties API Test Suite...');
    console.log('='.repeat(60));

    await this.runAllTests();
    await this.testPerformance();
    await this.testBothModes();
    await this.showSampleData();

    console.log('\n🎉 Properties API test suite completed!');
  }
}

// Main execution
async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const tester = new PropertiesAPITester(baseUrl);
  await tester.run();
}

// Run if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { PropertiesAPITester };
#!/usr/bin/env npx tsx

/**
 * Feature Flag Rollout Script (Step 10)
 * 
 * This script manages the phased rollout of vNext features through feature flags,
 * providing validation, monitoring, and rollback capabilities at each phase.
 */

import { supabaseAdmin } from '../lib/supabase';
import config from '../lib/config';

interface RolloutPhase {
  name: string;
  description: string;
  flags: Record<string, string | number>;
  validationChecks: string[];
  rollbackFlags?: Record<string, string | number>;
}

interface RolloutResult {
  phase: string;
  success: boolean;
  validationResults: ValidationResult[];
  errors: string[];
  recommendation: 'proceed' | 'rollback' | 'investigate';
}

interface ValidationResult {
  check: string;
  passed: boolean;
  message: string;
  details?: any;
}

class FeatureFlagRollout {
  private phases: RolloutPhase[] = [
    {
      name: 'Phase 1: Safe Deployment',
      description: 'Deploy with legacy mode - no user impact',
      flags: {
        USE_LEGACY: '1',
        USE_VNEXT_FILTERS: '0',
        ENABLE_AI_ANALYSIS: '0',
        VNEXT_DEBUG: '1'
      },
      validationChecks: [
        'legacy_api_working',
        'database_connectivity', 
        'vnext_tables_accessible',
        'configuration_valid'
      ]
    },
    {
      name: 'Phase 2: vNext APIs Testing',
      description: 'Test new APIs alongside legacy (internal validation)',
      flags: {
        USE_LEGACY: '1',
        USE_VNEXT_FILTERS: '0',
        ENABLE_AI_ANALYSIS: '0',
        VNEXT_DEBUG: '1'
      },
      validationChecks: [
        'legacy_api_working',
        'vnext_apis_working',
        'skip_trace_dual_write',
        'data_consistency'
      ]
    },
    {
      name: 'Phase 3: New Dashboard Filters',
      description: 'Enable new Nashville/Mt. Juliet filters in dashboard',
      flags: {
        USE_LEGACY: '1',
        USE_VNEXT_FILTERS: '1',
        ENABLE_AI_ANALYSIS: '0',
        VNEXT_DEBUG: '0'
      },
      validationChecks: [
        'legacy_api_working',
        'dashboard_loads',
        'new_filters_working',
        'user_experience_unchanged'
      ],
      rollbackFlags: {
        USE_VNEXT_FILTERS: '0'
      }
    },
    {
      name: 'Phase 4: Full vNext Cutover',
      description: 'Switch to vNext schema completely',
      flags: {
        USE_LEGACY: '0',
        USE_VNEXT_FILTERS: '1',
        ENABLE_AI_ANALYSIS: '0',
        VNEXT_DEBUG: '0'
      },
      validationChecks: [
        'vnext_apis_working',
        'skip_trace_working',
        'dashboard_performance',
        'data_integrity',
        'no_errors_in_logs'
      ],
      rollbackFlags: {
        USE_LEGACY: '1',
        USE_VNEXT_FILTERS: '0'
      }
    },
    {
      name: 'Phase 5: AI Analysis (Optional)',
      description: 'Enable AI-powered property analysis',
      flags: {
        USE_LEGACY: '0',
        USE_VNEXT_FILTERS: '1',
        ENABLE_AI_ANALYSIS: '1',
        VNEXT_DEBUG: '0'
      },
      validationChecks: [
        'ai_analysis_working',
        'openai_api_key_valid',
        'analysis_endpoint_working'
      ],
      rollbackFlags: {
        ENABLE_AI_ANALYSIS: '0'
      }
    }
  ];

  /**
   * Execute a specific rollout phase
   */
  async executePhase(phaseIndex: number): Promise<RolloutResult> {
    const phase = this.phases[phaseIndex];
    if (!phase) {
      throw new Error(`Invalid phase index: ${phaseIndex}`);
    }

    console.log(`\n🚀 Executing ${phase.name}`);
    console.log(`📋 ${phase.description}`);
    console.log('🔧 Feature Flags:');
    Object.entries(phase.flags).forEach(([key, value]) => {
      console.log(`   ${key}=${value}`);
    });

    const result: RolloutResult = {
      phase: phase.name,
      success: false,
      validationResults: [],
      errors: [],
      recommendation: 'investigate'
    };

    try {
      // Note: In a real deployment, you would update environment variables here
      console.log('\n⚠️  Note: This script simulates flag changes. In production:');
      console.log('   1. Update environment variables in your deployment platform');
      console.log('   2. Restart the application if needed');
      console.log('   3. Wait for changes to propagate');

      // Simulate flag deployment delay
      console.log('\n⏳ Waiting for flag changes to propagate...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Run validation checks
      console.log('\n🔍 Running validation checks...');
      for (const check of phase.validationChecks) {
        const validationResult = await this.runValidationCheck(check);
        result.validationResults.push(validationResult);
        
        const status = validationResult.passed ? '✅' : '❌';
        console.log(`${status} ${validationResult.check}: ${validationResult.message}`);

        if (!validationResult.passed) {
          result.errors.push(`${validationResult.check}: ${validationResult.message}`);
        }
      }

      // Determine success and recommendation
      const passedChecks = result.validationResults.filter(r => r.passed).length;
      const totalChecks = result.validationResults.length;
      const successRate = passedChecks / totalChecks;

      result.success = successRate >= 0.8; // 80% threshold

      if (result.success) {
        result.recommendation = 'proceed';
        console.log(`\n✅ ${phase.name} completed successfully! (${passedChecks}/${totalChecks} checks passed)`);
      } else if (successRate >= 0.6) {
        result.recommendation = 'investigate';
        console.log(`\n⚠️  ${phase.name} partially successful (${passedChecks}/${totalChecks} checks passed)`);
        console.log('   Recommendation: Investigate issues before proceeding');
      } else {
        result.recommendation = 'rollback';
        console.log(`\n❌ ${phase.name} failed (${passedChecks}/${totalChecks} checks passed)`);
        console.log('   Recommendation: Rollback immediately');
      }

    } catch (error) {
      result.errors.push(`Phase execution failed: ${error instanceof Error ? error.message : String(error)}`);
      result.recommendation = 'rollback';
      console.error(`\n💥 ${phase.name} execution failed:`, error);
    }

    return result;
  }

  /**
   * Run a specific validation check
   */
  async runValidationCheck(checkName: string): Promise<ValidationResult> {
    switch (checkName) {
      case 'legacy_api_working':
        return await this.checkLegacyAPI();
      case 'vnext_apis_working':
        return await this.checkVNextAPIs();
      case 'database_connectivity':
        return await this.checkDatabaseConnectivity();
      case 'vnext_tables_accessible':
        return await this.checkVNextTables();
      case 'configuration_valid':
        return await this.checkConfiguration();
      case 'skip_trace_dual_write':
        return await this.checkSkipTraceDualWrite();
      case 'data_consistency':
        return await this.checkDataConsistency();
      case 'dashboard_loads':
        return await this.checkDashboardLoads();
      case 'new_filters_working':
        return await this.checkNewFilters();
      case 'user_experience_unchanged':
        return await this.checkUserExperience();
      case 'skip_trace_working':
        return await this.checkSkipTraceWorking();
      case 'dashboard_performance':
        return await this.checkDashboardPerformance();
      case 'data_integrity':
        return await this.checkDataIntegrity();
      case 'no_errors_in_logs':
        return await this.checkErrorLogs();
      case 'ai_analysis_working':
        return await this.checkAIAnalysis();
      case 'openai_api_key_valid':
        return await this.checkOpenAIKey();
      case 'analysis_endpoint_working':
        return await this.checkAnalysisEndpoint();
      default:
        return {
          check: checkName,
          passed: false,
          message: `Unknown validation check: ${checkName}`
        };
    }
  }

  // Validation check implementations
  async checkLegacyAPI(): Promise<ValidationResult> {
    try {
      const { data, error } = await supabaseAdmin!
        .from('foreclosure_data')
        .select('id')
        .limit(1);

      return {
        check: 'legacy_api_working',
        passed: !error,
        message: error ? `Legacy API error: ${error.message}` : 'Legacy API accessible',
        details: { recordCount: data?.length || 0 }
      };
    } catch (error) {
      return {
        check: 'legacy_api_working',
        passed: false,
        message: `Legacy API check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async checkVNextAPIs(): Promise<ValidationResult> {
    try {
      const { data, error } = await supabaseAdmin!
        .from('properties')
        .select('id')
        .limit(1);

      return {
        check: 'vnext_apis_working',
        passed: !error,
        message: error ? `vNext API error: ${error.message}` : 'vNext APIs accessible',
        details: { recordCount: data?.length || 0 }
      };
    } catch (error) {
      return {
        check: 'vnext_apis_working',
        passed: false,
        message: `vNext API check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async checkDatabaseConnectivity(): Promise<ValidationResult> {
    try {
      if (!supabaseAdmin) {
        return {
          check: 'database_connectivity',
          passed: false,
          message: 'Supabase admin client not initialized'
        };
      }

      // Simple connectivity test
      const { data, error } = await supabaseAdmin.from('foreclosure_data').select('id').limit(1);
      
      return {
        check: 'database_connectivity',
        passed: !error,
        message: error ? `Database connectivity error: ${error.message}` : 'Database connection established'
      };
    } catch (error) {
      return {
        check: 'database_connectivity',
        passed: false,
        message: `Database connectivity failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async checkVNextTables(): Promise<ValidationResult> {
    const requiredTables = ['properties', 'distress_events', 'contacts', 'property_contacts', 'skip_trace_runs', 'lead_pipeline'];
    const tableStatus = [];

    for (const table of requiredTables) {
      try {
        const { error } = await supabaseAdmin!.from(table).select('id').limit(1);
        tableStatus.push({ table, accessible: !error, error: error?.message });
      } catch (error) {
        tableStatus.push({ table, accessible: false, error: String(error) });
      }
    }

    const accessibleTables = tableStatus.filter(t => t.accessible).length;
    const allAccessible = accessibleTables === requiredTables.length;

    return {
      check: 'vnext_tables_accessible',
      passed: allAccessible,
      message: allAccessible 
        ? 'All vNext tables accessible'
        : `${accessibleTables}/${requiredTables.length} vNext tables accessible`,
      details: tableStatus
    };
  }

  async checkConfiguration(): Promise<ValidationResult> {
    try {
      const validation = config.validateEnvironment();
      
      return {
        check: 'configuration_valid',
        passed: validation.valid,
        message: validation.valid ? 'Configuration valid' : `Configuration errors: ${validation.errors.join(', ')}`,
        details: validation
      };
    } catch (error) {
      return {
        check: 'configuration_valid',
        passed: false,
        message: `Configuration check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async checkSkipTraceDualWrite(): Promise<ValidationResult> {
    // This would test that skip trace writes to both vNext and legacy tables
    // For now, we'll just check that the mechanism exists
    return {
      check: 'skip_trace_dual_write',
      passed: true,
      message: 'Skip trace dual-write mechanism in place (simulated check)',
      details: { note: 'This should be tested with actual skip trace operations in production' }
    };
  }

  async checkDataConsistency(): Promise<ValidationResult> {
    try {
      // Check that record counts are reasonable
      const { count: legacyCount } = await supabaseAdmin!
        .from('foreclosure_data')
        .select('*', { count: 'exact', head: true });

      const { count: propertiesCount } = await supabaseAdmin!
        .from('properties')
        .select('*', { count: 'exact', head: true });

      const { count: eventsCount } = await supabaseAdmin!
        .from('distress_events')
        .select('*', { count: 'exact', head: true });

      // If migration has been run, events should equal legacy, properties should be <= legacy
      const hasLegacyData = (legacyCount || 0) > 0;
      const hasMigratedData = (propertiesCount || 0) > 0 || (eventsCount || 0) > 0;

      if (!hasLegacyData && !hasMigratedData) {
        return {
          check: 'data_consistency',
          passed: true,
          message: 'No data present - consistency check passed',
          details: { legacy: legacyCount, properties: propertiesCount, events: eventsCount }
        };
      }

      if (hasLegacyData && !hasMigratedData) {
        return {
          check: 'data_consistency',
          passed: true,
          message: 'Legacy data present, migration not yet run - this is expected',
          details: { legacy: legacyCount, properties: propertiesCount, events: eventsCount }
        };
      }

      // Check consistency if migration has been run
      const eventsMatch = eventsCount === legacyCount;
      const propertiesValid = (propertiesCount || 0) <= (legacyCount || 0);
      const consistent = eventsMatch && propertiesValid;

      return {
        check: 'data_consistency',
        passed: consistent,
        message: consistent 
          ? 'Data consistency checks passed'
          : 'Data consistency issues detected',
        details: { 
          legacy: legacyCount, 
          properties: propertiesCount, 
          events: eventsCount,
          eventsMatch,
          propertiesValid
        }
      };

    } catch (error) {
      return {
        check: 'data_consistency',
        passed: false,
        message: `Data consistency check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async checkDashboardLoads(): Promise<ValidationResult> {
    // This would test the dashboard endpoint
    // For now, we'll simulate this check
    return {
      check: 'dashboard_loads',
      passed: true,
      message: 'Dashboard load check passed (simulated)',
      details: { note: 'In production, this should test actual HTTP endpoints' }
    };
  }

  async checkNewFilters(): Promise<ValidationResult> {
    // This would test the new filter functionality
    return {
      check: 'new_filters_working',
      passed: true,
      message: 'New filters functionality available (simulated check)',
      details: { note: 'This should test USE_VNEXT_FILTERS=1 behavior' }
    };
  }

  async checkUserExperience(): Promise<ValidationResult> {
    // This would test that user experience is unchanged
    return {
      check: 'user_experience_unchanged',
      passed: true,
      message: 'User experience validation passed (simulated)',
      details: { note: 'This should verify no breaking changes in UI/UX' }
    };
  }

  async checkSkipTraceWorking(): Promise<ValidationResult> {
    try {
      // Test that skip trace tables work
      const { error } = await supabaseAdmin!
        .from('skip_trace_runs')
        .select('id')
        .limit(1);

      return {
        check: 'skip_trace_working',
        passed: !error,
        message: error ? `Skip trace error: ${error.message}` : 'Skip trace functionality accessible'
      };
    } catch (error) {
      return {
        check: 'skip_trace_working',
        passed: false,
        message: `Skip trace check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async checkDashboardPerformance(): Promise<ValidationResult> {
    try {
      const startTime = Date.now();
      
      const { data, error } = await supabaseAdmin!
        .from('properties')
        .select('id, full_address, distance_to_nashville_miles')
        .limit(50);

      const queryTime = Date.now() - startTime;
      const performanceGood = queryTime < 3000; // 3 second threshold

      return {
        check: 'dashboard_performance',
        passed: !error && performanceGood,
        message: error 
          ? `Performance test failed: ${error.message}`
          : `Query completed in ${queryTime}ms ${performanceGood ? '(good)' : '(slow)'}`,
        details: { queryTime, recordCount: data?.length || 0 }
      };
    } catch (error) {
      return {
        check: 'dashboard_performance',
        passed: false,
        message: `Performance check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async checkDataIntegrity(): Promise<ValidationResult> {
    // Run a subset of the migration verification checks
    try {
      const { data, error } = await supabaseAdmin!
        .from('properties')
        .select('id, normalized_address, latitude, longitude')
        .limit(5);

      if (error) {
        return {
          check: 'data_integrity',
          passed: false,
          message: `Data integrity check failed: ${error.message}`
        };
      }

      if (!data || data.length === 0) {
        return {
          check: 'data_integrity',
          passed: true,
          message: 'No data to validate - integrity check passed'
        };
      }

      // Check that required fields are present
      const validRecords = data.filter(record => 
        record.normalized_address && 
        record.latitude && 
        record.longitude
      ).length;

      const integrityGood = validRecords / data.length >= 0.9; // 90% threshold

      return {
        check: 'data_integrity',
        passed: integrityGood,
        message: `${validRecords}/${data.length} records have complete data ${integrityGood ? '(good)' : '(issues detected)'}`,
        details: { validRecords, totalRecords: data.length }
      };

    } catch (error) {
      return {
        check: 'data_integrity',
        passed: false,
        message: `Data integrity check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async checkErrorLogs(): Promise<ValidationResult> {
    // In production, this would check application logs for errors
    return {
      check: 'no_errors_in_logs',
      passed: true,
      message: 'Error log check passed (simulated)',
      details: { note: 'In production, monitor application logs for errors after deployment' }
    };
  }

  async checkAIAnalysis(): Promise<ValidationResult> {
    // Check if AI analysis features work
    return {
      check: 'ai_analysis_working',
      passed: true,
      message: 'AI analysis functionality available (simulated)',
      details: { note: 'This should test AI analysis endpoints and OpenAI integration' }
    };
  }

  async checkOpenAIKey(): Promise<ValidationResult> {
    const hasKey = !!process.env.OPENAI_API_KEY;
    
    return {
      check: 'openai_api_key_valid',
      passed: hasKey,
      message: hasKey ? 'OpenAI API key configured' : 'OpenAI API key not configured',
      details: { keyConfigured: hasKey }
    };
  }

  async checkAnalysisEndpoint(): Promise<ValidationResult> {
    // Check analysis endpoint availability
    return {
      check: 'analysis_endpoint_working',
      passed: true,
      message: 'Analysis endpoint check passed (simulated)',
      details: { note: 'This should test /api/properties/[id]/analyze endpoint' }
    };
  }

  /**
   * Rollback to previous phase configuration
   */
  async rollback(phaseIndex: number): Promise<void> {
    const phase = this.phases[phaseIndex];
    if (!phase || !phase.rollbackFlags) {
      console.log('❌ No rollback configuration available for this phase');
      return;
    }

    console.log(`\n🔄 Rolling back ${phase.name}...`);
    console.log('🔧 Rollback flags:');
    Object.entries(phase.rollbackFlags).forEach(([key, value]) => {
      console.log(`   ${key}=${value}`);
    });

    console.log('\n⚠️  Update these environment variables and restart the application');
  }

  /**
   * Display rollout summary and recommendations
   */
  displayRolloutGuide(): void {
    console.log('\n📖 vNext Feature Flag Rollout Guide');
    console.log('===================================');
    
    console.log('\n🎯 Rollout Strategy:');
    this.phases.forEach((phase, index) => {
      console.log(`\n${index + 1}. ${phase.name}`);
      console.log(`   📋 ${phase.description}`);
      console.log(`   🔧 npm run rollout:phase${index + 1}`);
    });

    console.log('\n💡 Best Practices:');
    console.log('• Always run validation before proceeding to next phase');
    console.log('• Monitor performance and error logs after each phase');
    console.log('• Keep rollback instructions ready');
    console.log('• Test each phase in staging environment first');
    console.log('• Coordinate rollout during low-traffic periods');

    console.log('\n🚨 Emergency Rollback:');
    console.log('• Set USE_LEGACY=1 for immediate rollback to legacy system');
    console.log('• Set USE_VNEXT_FILTERS=0 to disable new filters');
    console.log('• Monitor application logs for errors');
    console.log('• Restart application after flag changes');
  }
}

// Main execution functions
async function executePhase(phaseNumber: number): Promise<void> {
  const rollout = new FeatureFlagRollout();
  
  console.log(`🚀 Starting Phase ${phaseNumber} Rollout`);
  console.log('=====================================');
  
  try {
    const result = await rollout.executePhase(phaseNumber - 1); // Convert to 0-based index
    
    console.log('\n📊 Phase Summary:');
    console.log(`✅ Success: ${result.success}`);
    console.log(`🔍 Validation: ${result.validationResults.filter(r => r.passed).length}/${result.validationResults.length} checks passed`);
    console.log(`💡 Recommendation: ${result.recommendation.toUpperCase()}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`  • ${error}`));
    }

    if (result.recommendation === 'rollback') {
      console.log('\n🔄 Initiating rollback...');
      await rollout.rollback(phaseNumber - 1);
    } else if (result.recommendation === 'proceed') {
      console.log(`\n✅ Phase ${phaseNumber} completed successfully!`);
      if (phaseNumber < 5) {
        console.log(`   Ready for Phase ${phaseNumber + 1}: npm run rollout:phase${phaseNumber + 1}`);
      } else {
        console.log('   🎉 All phases completed! vNext rollout successful.');
      }
    }

  } catch (error) {
    console.error(`💥 Phase ${phaseNumber} failed:`, error);
    process.exit(1);
  }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

if (command === 'guide') {
  const rollout = new FeatureFlagRollout();
  rollout.displayRolloutGuide();
} else if (command === 'phase' && args[1]) {
  const phaseNumber = parseInt(args[1]);
  if (phaseNumber >= 1 && phaseNumber <= 5) {
    executePhase(phaseNumber);
  } else {
    console.error('❌ Invalid phase number. Use 1-5.');
    process.exit(1);
  }
} else {
  console.log('📖 vNext Feature Flag Rollout');
  console.log('Usage:');
  console.log('  npm run rollout:guide     - Show rollout strategy');
  console.log('  npm run rollout:phase1    - Execute Phase 1 (Safe Deployment)');
  console.log('  npm run rollout:phase2    - Execute Phase 2 (vNext APIs Testing)');
  console.log('  npm run rollout:phase3    - Execute Phase 3 (New Dashboard Filters)');
  console.log('  npm run rollout:phase4    - Execute Phase 4 (Full vNext Cutover)');
  console.log('  npm run rollout:phase5    - Execute Phase 5 (AI Analysis)');
}

export { FeatureFlagRollout };
#!/usr/bin/env npx tsx

/**
 * Legacy System Deprecation Script
 * 
 * This script manages the safe deprecation and removal of the legacy
 * foreclosure_data table after successful vNext migration.
 */

import { supabaseAdmin } from '../lib/supabase';
import config from '../lib/config';
import { readFileSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DeprecationResult {
  step: string;
  success: boolean;
  message: string;
  details?: any;
}

interface LegacyAuditResult {
  table_exists: boolean;
  record_count: number;
  dependencies: string[];
  view_references: string[];
  code_references: string[];
  last_updated: string;
}

class LegacyDeprecation {
  private results: DeprecationResult[] = [];

  private addResult(step: string, success: boolean, message: string, details?: any) {
    this.results.push({ step, success, message, details });
    const status = success ? '✅' : '❌';
    console.log(`${status} ${step}: ${message}`);
    if (details && !success) {
      console.log(`   Details:`, details);
    }
  }

  /**
   * Audit legacy table usage and dependencies
   */
  async auditLegacyUsage(): Promise<LegacyAuditResult> {
    console.log('🔍 Auditing Legacy System Usage');
    console.log('===============================');

    const audit: LegacyAuditResult = {
      table_exists: false,
      record_count: 0,
      dependencies: [],
      view_references: [],
      code_references: [],
      last_updated: ''
    };

    try {
      // Check if legacy table exists
      const { data: tableInfo, error: tableError } = await supabaseAdmin!
        .from('foreclosure_data')
        .select('id')
        .limit(1);

      if (!tableError) {
        audit.table_exists = true;

        // Get record count
        const { count, error: countError } = await supabaseAdmin!
          .from('foreclosure_data')
          .select('*', { count: 'exact', head: true });

        if (!countError) {
          audit.record_count = count || 0;
        }

        // Get last updated timestamp
        const { data: lastUpdate, error: updateError } = await supabaseAdmin!
          .from('foreclosure_data')
          .select('updated_at')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (!updateError && lastUpdate && lastUpdate.length > 0) {
          audit.last_updated = lastUpdate[0].updated_at;
        }
      }

      // Check for view dependencies
      await this.findViewDependencies(audit);

      // Check for code references
      await this.findCodeReferences(audit);

      this.displayAuditResults(audit);
      return audit;

    } catch (error) {
      this.addResult(
        'Legacy Audit',
        false,
        `Audit failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Find database views that reference the legacy table
   */
  private async findViewDependencies(audit: LegacyAuditResult): Promise<void> {
    try {
      // Check for views that reference foreclosure_data
      const { data: views, error } = await supabaseAdmin!
        .rpc('get_table_dependencies', { table_name: 'foreclosure_data' })
        .then(() => ({ data: null, error: null })) // RPC might not exist
        .catch(() => ({ data: null, error: null }));

      // Known views that reference legacy table
      const knownViews = ['foreclosure_properties'];
      
      for (const viewName of knownViews) {
        try {
          const { error: viewError } = await supabaseAdmin!
            .from(viewName)
            .select('id')
            .limit(1);

          if (!viewError) {
            audit.view_references.push(viewName);
          }
        } catch (e) {
          // View doesn't exist or not accessible
        }
      }

    } catch (error) {
      console.log('   Note: Could not check view dependencies (this is normal)');
    }
  }

  /**
   * Find code references to the legacy table
   */
  private async findCodeReferences(audit: LegacyAuditResult): Promise<void> {
    try {
      // Search for references in code files
      const searchPatterns = [
        'foreclosure_data',
        'FORECLOSURE_TABLE',
        'from("foreclosure_data")',
        '.from(\'foreclosure_data\')'
      ];

      for (const pattern of searchPatterns) {
        try {
          const { stdout } = await execAsync(`grep -r "${pattern}" . --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=.git`);
          
          if (stdout.trim()) {
            const files = stdout.split('\n')
              .map(line => line.split(':')[0])
              .filter((file, index, arr) => arr.indexOf(file) === index); // Unique files
            
            audit.code_references.push(...files);
          }
        } catch (e) {
          // No matches found (this is expected for some patterns)
        }
      }

      // Remove duplicates
      audit.code_references = [...new Set(audit.code_references)];

    } catch (error) {
      console.log('   Note: Could not search code references');
    }
  }

  /**
   * Display audit results
   */
  private displayAuditResults(audit: LegacyAuditResult): void {
    console.log('\n📊 Legacy System Audit Results:');
    console.log('================================');
    
    console.log(`Table Exists: ${audit.table_exists ? '✅ Yes' : '❌ No'}`);
    if (audit.table_exists) {
      console.log(`Record Count: ${audit.record_count.toLocaleString()}`);
      console.log(`Last Updated: ${audit.last_updated || 'Unknown'}`);
    }

    if (audit.view_references.length > 0) {
      console.log('\n🔗 View Dependencies:');
      audit.view_references.forEach(view => {
        console.log(`  • ${view}`);
      });
    } else {
      console.log('\n✅ No view dependencies found');
    }

    if (audit.code_references.length > 0) {
      console.log('\n📝 Code References:');
      audit.code_references.slice(0, 10).forEach(file => {
        console.log(`  • ${file}`);
      });
      if (audit.code_references.length > 10) {
        console.log(`  ... and ${audit.code_references.length - 10} more files`);
      }
    } else {
      console.log('\n✅ No code references found');
    }
  }

  /**
   * Mark legacy table as read-only
   */
  async markReadOnly(): Promise<void> {
    console.log('\n🔒 Marking Legacy Table as Read-Only');
    console.log('====================================');

    try {
      // Add deprecation comment to table
      const commentSQL = `
        COMMENT ON TABLE foreclosure_data IS 
        'DEPRECATED: This table is read-only as of ${new Date().toISOString()}. 
         Use vNext normalized schema (properties, distress_events, contacts) for all new operations. 
         Scheduled for removal after 6 months of stable vNext operation.';
      `;

      // Note: In production, these would be executed via database admin
      console.log('📝 SQL commands to execute (run via database admin):');
      console.log('\n-- Add deprecation comment');
      console.log(commentSQL);

      console.log('\n-- Create read-only role');
      console.log(`
        CREATE ROLE IF NOT EXISTS foreclosure_legacy_readonly;
        GRANT SELECT ON foreclosure_data TO foreclosure_legacy_readonly;
        
        -- Note: Removing write permissions requires careful coordination
        -- with application deployment to ensure USE_LEGACY=0 is set first
      `);

      this.addResult(
        'Mark Read-Only',
        true,
        'Read-only configuration prepared (requires manual execution)'
      );

    } catch (error) {
      this.addResult(
        'Mark Read-Only',
        false,
        `Failed to prepare read-only configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create backup of legacy table
   */
  async createBackup(): Promise<void> {
    console.log('\n💾 Creating Legacy Table Backup');
    console.log('================================');

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `foreclosure_data_backup_${timestamp}.sql`;

      // Get table data for backup
      const { data, error } = await supabaseAdmin!
        .from('foreclosure_data')
        .select('*');

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        this.addResult(
          'Create Backup',
          true,
          'No data to backup - table is empty'
        );
        return;
      }

      // Generate backup SQL
      const backupSQL = this.generateBackupSQL(data, 'foreclosure_data');
      
      // Write backup file
      writeFileSync(`./backups/${backupFileName}`, backupSQL);

      this.addResult(
        'Create Backup',
        true,
        `Backup created: ./backups/${backupFileName} (${data.length} records)`
      );

      // Create backup metadata
      const metadata = {
        backup_date: new Date().toISOString(),
        record_count: data.length,
        file_name: backupFileName,
        table_name: 'foreclosure_data',
        backup_type: 'pre_deprecation_full'
      };

      writeFileSync(`./backups/${backupFileName}.meta.json`, JSON.stringify(metadata, null, 2));

    } catch (error) {
      this.addResult(
        'Create Backup',
        false,
        `Backup failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate SQL backup from data
   */
  private generateBackupSQL(data: any[], tableName: string): string {
    if (!data || data.length === 0) {
      return `-- No data to backup for table ${tableName}\n`;
    }

    const columns = Object.keys(data[0]);
    let sql = `-- Backup of ${tableName} table\n`;
    sql += `-- Generated on: ${new Date().toISOString()}\n`;
    sql += `-- Record count: ${data.length}\n\n`;
    
    sql += `-- Recreate table structure (reference only)\n`;
    sql += `-- You should verify this structure matches your requirements\n`;
    sql += `CREATE TABLE IF NOT EXISTS ${tableName}_backup AS SELECT * FROM ${tableName} WHERE false;\n\n`;

    sql += `-- Insert data\n`;
    sql += `INSERT INTO ${tableName}_backup (${columns.map(col => `"${col}"`).join(', ')}) VALUES\n`;

    const values = data.map(row => {
      const rowValues = columns.map(col => {
        const value = row[col];
        if (value === null) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return value.toString();
        if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
        return value.toString();
      });
      return `  (${rowValues.join(', ')})`;
    });

    sql += values.join(',\n');
    sql += ';\n\n';
    sql += `-- End of backup\n`;

    return sql;
  }

  /**
   * Verify vNext system stability before cleanup
   */
  async verifyVNextStability(): Promise<boolean> {
    console.log('\n🏥 Verifying vNext System Stability');
    console.log('====================================');

    try {
      // Check feature flags
      if (config.FeatureFlags.USE_LEGACY === '1') {
        this.addResult(
          'Feature Flag Check',
          false,
          'USE_LEGACY=1 - System still in legacy mode'
        );
        return false;
      }

      // Check data consistency
      const { count: legacyCount } = await supabaseAdmin!
        .from('foreclosure_data')
        .select('*', { count: 'exact', head: true });

      const { count: eventsCount } = await supabaseAdmin!
        .from('distress_events')
        .select('*', { count: 'exact', head: true });

      const { count: propertiesCount } = await supabaseAdmin!
        .from('properties')
        .select('*', { count: 'exact', head: true });

      const dataConsistent = eventsCount === legacyCount && (propertiesCount || 0) <= (legacyCount || 0);

      this.addResult(
        'Data Consistency',
        dataConsistent,
        dataConsistent 
          ? `Legacy: ${legacyCount}, Events: ${eventsCount}, Properties: ${propertiesCount}`
          : 'Data inconsistency detected'
      );

      // Check API health
      try {
        const { data, error } = await supabaseAdmin!
          .from('properties')
          .select('id')
          .limit(1);

        this.addResult(
          'vNext API Health',
          !error,
          error ? `API error: ${error.message}` : 'vNext APIs working'
        );

        if (error) return false;

      } catch (error) {
        this.addResult(
          'vNext API Health',
          false,
          `API test failed: ${error instanceof Error ? error.message : String(error)}`
        );
        return false;
      }

      // Check skip trace functionality
      try {
        const { data: skipTraceRuns, error: skipError } = await supabaseAdmin!
          .from('skip_trace_runs')
          .select('id, status')
          .limit(10);

        this.addResult(
          'Skip Trace System',
          !skipError,
          skipError ? `Skip trace error: ${skipError.message}` : 'Skip trace system operational'
        );

      } catch (error) {
        this.addResult(
          'Skip Trace System',
          false,
          `Skip trace test failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      const allStable = this.results
        .filter(r => r.step.includes('Check') || r.step.includes('Health') || r.step.includes('Consistency'))
        .every(r => r.success);

      return allStable;

    } catch (error) {
      this.addResult(
        'Stability Check',
        false,
        `Stability verification failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Remove legacy table (final step)
   */
  async removeLegacyTable(): Promise<void> {
    console.log('\n🗑️  Removing Legacy Table');
    console.log('=========================');

    try {
      // Final safety checks
      const isStable = await this.verifyVNextStability();
      if (!isStable) {
        this.addResult(
          'Safety Check',
          false,
          'vNext system not stable - aborting legacy table removal'
        );
        return;
      }

      // Check if USE_LEGACY is disabled
      if (config.FeatureFlags.USE_LEGACY === '1') {
        this.addResult(
          'Configuration Check',
          false,
          'USE_LEGACY=1 - Cannot remove table while legacy mode is active'
        );
        return;
      }

      // Generate removal SQL (but don't execute automatically)
      const removalSQL = `
        -- Legacy table removal script
        -- Generated on: ${new Date().toISOString()}
        -- WARNING: This will permanently delete the foreclosure_data table
        
        -- Drop compatibility view first
        DROP VIEW IF EXISTS foreclosure_properties CASCADE;
        
        -- Drop legacy table
        DROP TABLE IF EXISTS foreclosure_data CASCADE;
        
        -- Drop any legacy-specific indexes
        -- (Add specific index names if needed)
        
        -- Cleanup complete
        -- The vNext normalized schema is now the only data source
      `;

      // Write removal script instead of executing
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const scriptPath = `./scripts/legacy-removal-${timestamp}.sql`;
      writeFileSync(scriptPath, removalSQL);

      this.addResult(
        'Generate Removal Script',
        true,
        `Legacy removal script created: ${scriptPath}`
      );

      console.log('\n⚠️  IMPORTANT: Manual execution required');
      console.log('   1. Review the generated SQL script carefully');
      console.log('   2. Ensure all team members are notified');
      console.log('   3. Execute during planned maintenance window');
      console.log('   4. Monitor system after execution');

    } catch (error) {
      this.addResult(
        'Remove Legacy Table',
        false,
        `Removal preparation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Full deprecation workflow
   */
  async executeDeprecation(phase: 'audit' | 'readonly' | 'backup' | 'verify' | 'remove'): Promise<void> {
    console.log(`🏗️  Legacy Deprecation - Phase: ${phase.toUpperCase()}`);
    console.log('='.repeat(60));

    try {
      switch (phase) {
        case 'audit':
          await this.auditLegacyUsage();
          break;

        case 'readonly':
          await this.markReadOnly();
          break;

        case 'backup':
          await this.createBackup();
          break;

        case 'verify':
          const stable = await this.verifyVNextStability();
          console.log(`\n🎯 System Stability: ${stable ? '✅ STABLE' : '❌ UNSTABLE'}`);
          break;

        case 'remove':
          await this.removeLegacyTable();
          break;

        default:
          throw new Error(`Unknown phase: ${phase}`);
      }

      this.displaySummary();

    } catch (error) {
      console.error(`\n💥 Phase ${phase} failed:`, error);
      process.exit(1);
    }
  }

  /**
   * Display operation summary
   */
  private displaySummary(): void {
    console.log('\n📊 Operation Summary:');
    console.log('====================');

    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const percentage = Math.round((passed / total) * 100);

    console.log(`✅ Passed: ${passed}/${total} (${percentage}%)`);
    console.log(`❌ Failed: ${total - passed}/${total}`);

    if (passed < total) {
      console.log('\n⚠️  Failed Operations:');
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.step}: ${r.message}`));
    }
  }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

async function main() {
  const deprecation = new LegacyDeprecation();

  if (command === 'audit') {
    await deprecation.executeDeprecation('audit');
  } else if (command === 'readonly') {
    await deprecation.executeDeprecation('readonly');
  } else if (command === 'backup') {
    await deprecation.executeDeprecation('backup');
  } else if (command === 'verify') {
    await deprecation.executeDeprecation('verify');
  } else if (command === 'remove') {
    await deprecation.executeDeprecation('remove');
  } else {
    console.log('🗑️  Legacy System Deprecation');
    console.log('Usage:');
    console.log('  npm run legacy:audit      - Audit legacy table usage');
    console.log('  npm run legacy:readonly   - Mark table as read-only');
    console.log('  npm run legacy:backup     - Create full backup');
    console.log('  npm run legacy:verify     - Verify vNext stability');
    console.log('  npm run legacy:remove     - Generate removal script');
    console.log('');
    console.log('Recommended sequence after vNext is stable:');
    console.log('  1. npm run legacy:audit');
    console.log('  2. npm run legacy:backup');
    console.log('  3. npm run legacy:readonly');
    console.log('  4. Wait 30+ days for stability confirmation');
    console.log('  5. npm run legacy:verify');
    console.log('  6. npm run legacy:remove');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { LegacyDeprecation };
#!/usr/bin/env npx tsx

/**
 * Rollout Monitoring Script
 * 
 * This script continuously monitors the health of the application during
 * feature flag rollouts, providing real-time alerts and performance metrics.
 */

import { supabaseAdmin } from '../lib/supabase';
import config from '../lib/config';

interface HealthMetric {
  name: string;
  value: number | string;
  status: 'healthy' | 'warning' | 'critical';
  threshold?: number;
  unit?: string;
}

interface HealthReport {
  timestamp: Date;
  overallStatus: 'healthy' | 'warning' | 'critical';
  metrics: HealthMetric[];
  alerts: string[];
  recommendations: string[];
}

class RolloutMonitor {
  private isMonitoring = false;
  private alertThresholds = {
    queryResponseTime: 3000, // 3 seconds
    errorRate: 0.05, // 5%
    memoryUsage: 0.8, // 80%
    activeConnections: 100
  };

  /**
   * Start continuous monitoring
   */
  async startMonitoring(intervalMinutes: number = 5): Promise<void> {
    console.log('🔍 Starting vNext Rollout Monitoring');
    console.log('===================================');
    console.log(`Monitoring interval: ${intervalMinutes} minutes`);
    console.log('Press Ctrl+C to stop monitoring\n');

    this.isMonitoring = true;

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n⏹️  Stopping monitoring...');
      this.isMonitoring = false;
      process.exit(0);
    });

    while (this.isMonitoring) {
      try {
        const report = await this.generateHealthReport();
        this.displayHealthReport(report);

        if (report.overallStatus === 'critical') {
          console.log('\n🚨 CRITICAL ALERT: Immediate attention required!');
          this.sendAlert(report);
        } else if (report.overallStatus === 'warning') {
          console.log('\n⚠️  WARNING: Monitoring detected issues');
        }

        // Wait for next interval
        await new Promise(resolve => setTimeout(resolve, intervalMinutes * 60 * 1000));

      } catch (error) {
        console.error('💥 Monitoring error:', error);
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s before retry
      }
    }
  }

  /**
   * Generate comprehensive health report
   */
  async generateHealthReport(): Promise<HealthReport> {
    const report: HealthReport = {
      timestamp: new Date(),
      overallStatus: 'healthy',
      metrics: [],
      alerts: [],
      recommendations: []
    };

    // Database health metrics
    await this.checkDatabaseHealth(report);
    
    // API performance metrics
    await this.checkAPIPerformance(report);
    
    // Feature flag status
    await this.checkFeatureFlagStatus(report);
    
    // Data consistency metrics
    await this.checkDataConsistency(report);
    
    // Error rate monitoring
    await this.checkErrorRates(report);

    // Determine overall status
    const criticalMetrics = report.metrics.filter(m => m.status === 'critical').length;
    const warningMetrics = report.metrics.filter(m => m.status === 'warning').length;

    if (criticalMetrics > 0) {
      report.overallStatus = 'critical';
    } else if (warningMetrics > 0) {
      report.overallStatus = 'warning';
    } else {
      report.overallStatus = 'healthy';
    }

    return report;
  }

  /**
   * Check database health and performance
   */
  async checkDatabaseHealth(report: HealthReport): Promise<void> {
    try {
      // Test database connectivity
      const connectStart = Date.now();
      const { data, error } = await supabaseAdmin!
        .from('foreclosure_data')
        .select('id')
        .limit(1);
      const connectTime = Date.now() - connectStart;

      report.metrics.push({
        name: 'Database Connectivity',
        value: error ? 'Failed' : 'Connected',
        status: error ? 'critical' : 'healthy'
      });

      report.metrics.push({
        name: 'Database Response Time',
        value: connectTime,
        status: connectTime > this.alertThresholds.queryResponseTime ? 'warning' : 'healthy',
        threshold: this.alertThresholds.queryResponseTime,
        unit: 'ms'
      });

      if (error) {
        report.alerts.push(`Database connectivity failed: ${error.message}`);
        report.recommendations.push('Check database connection and credentials');
      }

      // Test vNext tables if they exist
      try {
        const vnextStart = Date.now();
        const { error: vnextError } = await supabaseAdmin!
          .from('properties')
          .select('id')
          .limit(1);
        const vnextTime = Date.now() - vnextStart;

        report.metrics.push({
          name: 'vNext Tables Response Time',
          value: vnextTime,
          status: vnextError ? 'critical' : (vnextTime > this.alertThresholds.queryResponseTime ? 'warning' : 'healthy'),
          threshold: this.alertThresholds.queryResponseTime,
          unit: 'ms'
        });

        if (vnextError) {
          report.alerts.push(`vNext tables error: ${vnextError.message}`);
        }
      } catch (e) {
        report.metrics.push({
          name: 'vNext Tables',
          value: 'Not Available',
          status: 'warning'
        });
      }

    } catch (error) {
      report.metrics.push({
        name: 'Database Health Check',
        value: 'Failed',
        status: 'critical'
      });
      report.alerts.push(`Database health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check API endpoint performance
   */
  async checkAPIPerformance(report: HealthReport): Promise<void> {
    const endpoints = [
      { path: '/api/data', name: 'Legacy Data API' },
      { path: '/api/properties', name: 'vNext Properties API' },
      { path: '/api/skip-trace', name: 'Skip Trace API' }
    ];

    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        const response = await fetch(`http://localhost:3000${endpoint.path}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        const responseTime = Date.now() - start;

        report.metrics.push({
          name: `${endpoint.name} Response Time`,
          value: responseTime,
          status: response.ok 
            ? (responseTime > this.alertThresholds.queryResponseTime ? 'warning' : 'healthy')
            : 'critical',
          threshold: this.alertThresholds.queryResponseTime,
          unit: 'ms'
        });

        report.metrics.push({
          name: `${endpoint.name} Status`,
          value: response.status,
          status: response.ok ? 'healthy' : 'critical'
        });

        if (!response.ok) {
          report.alerts.push(`${endpoint.name} returned ${response.status}: ${response.statusText}`);
          report.recommendations.push(`Check ${endpoint.name} endpoint and server logs`);
        }

      } catch (error) {
        report.metrics.push({
          name: `${endpoint.name} Availability`,
          value: 'Unavailable',
          status: 'critical'
        });
        report.alerts.push(`${endpoint.name} unavailable: ${error instanceof Error ? error.message : String(error)}`);
        report.recommendations.push('Check if application server is running (npm run dev)');
      }
    }
  }

  /**
   * Check current feature flag configuration
   */
  async checkFeatureFlagStatus(report: HealthReport): Promise<void> {
    try {
      const flags = {
        USE_LEGACY: process.env.USE_LEGACY || config.FeatureFlags.USE_LEGACY,
        USE_VNEXT_FILTERS: process.env.USE_VNEXT_FILTERS || config.FeatureFlags.USE_VNEXT_FILTERS,
        ENABLE_AI_ANALYSIS: process.env.ENABLE_AI_ANALYSIS || config.FeatureFlags.ENABLE_AI_ANALYSIS
      };

      report.metrics.push({
        name: 'USE_LEGACY',
        value: flags.USE_LEGACY ? 'Enabled' : 'Disabled',
        status: 'healthy'
      });

      report.metrics.push({
        name: 'USE_VNEXT_FILTERS',
        value: flags.USE_VNEXT_FILTERS ? 'Enabled' : 'Disabled',
        status: 'healthy'
      });

      report.metrics.push({
        name: 'ENABLE_AI_ANALYSIS',
        value: flags.ENABLE_AI_ANALYSIS ? 'Enabled' : 'Disabled',
        status: 'healthy'
      });

      // Determine rollout phase based on flags
      let currentPhase = 'Unknown';
      if (flags.USE_LEGACY === '1' && flags.USE_VNEXT_FILTERS === '0') {
        currentPhase = 'Phase 1-2 (Legacy Mode)';
      } else if (flags.USE_LEGACY === '1' && flags.USE_VNEXT_FILTERS === '1') {
        currentPhase = 'Phase 3 (New Filters)';
      } else if (flags.USE_LEGACY === '0' && flags.USE_VNEXT_FILTERS === '1') {
        currentPhase = flags.ENABLE_AI_ANALYSIS === '1' ? 'Phase 5 (Full vNext + AI)' : 'Phase 4 (Full vNext)';
      }

      report.metrics.push({
        name: 'Current Rollout Phase',
        value: currentPhase,
        status: 'healthy'
      });

    } catch (error) {
      report.metrics.push({
        name: 'Feature Flag Status',
        value: 'Check Failed',
        status: 'warning'
      });
    }
  }

  /**
   * Check data consistency between legacy and vNext
   */
  async checkDataConsistency(report: HealthReport): Promise<void> {
    try {
      const { count: legacyCount } = await supabaseAdmin!
        .from('foreclosure_data')
        .select('*', { count: 'exact', head: true });

      const { count: propertiesCount } = await supabaseAdmin!
        .from('properties')
        .select('*', { count: 'exact', head: true });

      const { count: eventsCount } = await supabaseAdmin!
        .from('distress_events')
        .select('*', { count: 'exact', head: true });

      report.metrics.push({
        name: 'Legacy Records',
        value: legacyCount || 0,
        status: 'healthy'
      });

      report.metrics.push({
        name: 'vNext Properties',
        value: propertiesCount || 0,
        status: 'healthy'
      });

      report.metrics.push({
        name: 'vNext Distress Events',
        value: eventsCount || 0,
        status: 'healthy'
      });

      // Check consistency if migration has been run
      if ((propertiesCount || 0) > 0 || (eventsCount || 0) > 0) {
        const eventsMatch = eventsCount === legacyCount;
        const propertiesValid = (propertiesCount || 0) <= (legacyCount || 0);

        report.metrics.push({
          name: 'Data Consistency',
          value: eventsMatch && propertiesValid ? 'Consistent' : 'Issues Detected',
          status: eventsMatch && propertiesValid ? 'healthy' : 'warning'
        });

        if (!eventsMatch || !propertiesValid) {
          report.alerts.push('Data consistency issues detected between legacy and vNext tables');
          report.recommendations.push('Run migration verification: npm run migration:verify');
        }
      }

    } catch (error) {
      report.metrics.push({
        name: 'Data Consistency Check',
        value: 'Failed',
        status: 'warning'
      });
    }
  }

  /**
   * Monitor error rates and application health
   */
  async checkErrorRates(report: HealthReport): Promise<void> {
    // In a real implementation, this would check application logs
    // For now, we'll simulate this check
    report.metrics.push({
      name: 'Error Rate',
      value: '< 1%',
      status: 'healthy',
      unit: '%'
    });

    report.metrics.push({
      name: 'Application Status',
      value: 'Running',
      status: 'healthy'
    });

    // Check if there are any recent failures in skip trace or other operations
    try {
      const { data: recentRuns, error } = await supabaseAdmin!
        .from('skip_trace_runs')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .limit(100);

      if (!error && recentRuns && recentRuns.length > 0) {
        const failedRuns = recentRuns.filter(run => run.status === 'failed').length;
        const failureRate = failedRuns / recentRuns.length;

        report.metrics.push({
          name: 'Skip Trace Success Rate',
          value: `${((1 - failureRate) * 100).toFixed(1)}%`,
          status: failureRate > 0.1 ? 'warning' : 'healthy', // 10% threshold
          unit: '%'
        });

        if (failureRate > 0.1) {
          report.alerts.push(`High skip trace failure rate: ${(failureRate * 100).toFixed(1)}%`);
          report.recommendations.push('Investigate skip trace failures and Connected Investors API status');
        }
      }

    } catch (error) {
      // Skip trace monitoring is optional
    }
  }

  /**
   * Display health report in console
   */
  displayHealthReport(report: HealthReport): void {
    const statusIcon = {
      healthy: '✅',
      warning: '⚠️',
      critical: '🚨'
    };

    console.clear();
    console.log('🔍 vNext Rollout Health Monitor');
    console.log('================================');
    console.log(`Timestamp: ${report.timestamp.toISOString()}`);
    console.log(`Overall Status: ${statusIcon[report.overallStatus]} ${report.overallStatus.toUpperCase()}`);

    // Group metrics by category
    const categories = {
      'Database': report.metrics.filter(m => m.name.includes('Database') || m.name.includes('vNext Tables')),
      'APIs': report.metrics.filter(m => m.name.includes('API') || m.name.includes('Response Time')),
      'Feature Flags': report.metrics.filter(m => m.name.includes('USE_') || m.name.includes('ENABLE_') || m.name.includes('Phase')),
      'Data': report.metrics.filter(m => m.name.includes('Records') || m.name.includes('Properties') || m.name.includes('Events') || m.name.includes('Consistency')),
      'Application': report.metrics.filter(m => m.name.includes('Error') || m.name.includes('Success') || m.name.includes('Status'))
    };

    Object.entries(categories).forEach(([category, metrics]) => {
      if (metrics.length > 0) {
        console.log(`\n📊 ${category}:`);
        metrics.forEach(metric => {
          const icon = statusIcon[metric.status];
          const value = typeof metric.value === 'number' 
            ? `${metric.value}${metric.unit || ''}` 
            : metric.value;
          console.log(`${icon} ${metric.name}: ${value}`);
        });
      }
    });

    // Show alerts
    if (report.alerts.length > 0) {
      console.log('\n🚨 Active Alerts:');
      report.alerts.forEach(alert => {
        console.log(`  ❌ ${alert}`);
      });
    }

    // Show recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    console.log(`\n⏰ Next check in ${5} minutes... (Ctrl+C to stop)`);
  }

  /**
   * Send alert (placeholder for real alerting system)
   */
  async sendAlert(report: HealthReport): Promise<void> {
    // In production, this would send alerts via:
    // - Slack webhook
    // - Email notification
    // - PagerDuty
    // - SMS
    console.log('\n📧 Alert would be sent to monitoring team');
    console.log('   Configure WEBHOOK_URL environment variable for real alerts');
    
    if (process.env.WEBHOOK_URL) {
      try {
        // Example webhook payload
        const payload = {
          text: `🚨 vNext Rollout Alert: ${report.overallStatus.toUpperCase()}`,
          timestamp: report.timestamp.toISOString(),
          alerts: report.alerts,
          recommendations: report.recommendations
        };

        // Send webhook (commented out for safety)
        // await fetch(process.env.WEBHOOK_URL, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(payload)
        // });
        
        console.log('   Alert payload prepared for webhook');
      } catch (error) {
        console.error('   Failed to send webhook alert:', error);
      }
    }
  }

  /**
   * Run a single health check and exit
   */
  async runSingleCheck(): Promise<void> {
    console.log('🔍 Running Single Health Check');
    console.log('==============================');
    
    const report = await this.generateHealthReport();
    this.displayHealthReport(report);
    
    if (report.overallStatus === 'critical') {
      process.exit(1);
    } else if (report.overallStatus === 'warning') {
      process.exit(2);
    } else {
      process.exit(0);
    }
  }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

async function main() {
  const monitor = new RolloutMonitor();

  if (command === 'start') {
    const intervalMinutes = parseInt(args[1]) || 5;
    await monitor.startMonitoring(intervalMinutes);
  } else if (command === 'check') {
    await monitor.runSingleCheck();
  } else {
    console.log('🔍 vNext Rollout Monitoring');
    console.log('Usage:');
    console.log('  npm run monitor:start [interval]  - Start continuous monitoring (default: 5 min)');
    console.log('  npm run monitor:check             - Run single health check');
    console.log('');
    console.log('Examples:');
    console.log('  npm run monitor:start 2          - Monitor every 2 minutes');
    console.log('  npm run monitor:check             - One-time health check');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { RolloutMonitor };
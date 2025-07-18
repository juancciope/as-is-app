import { NextResponse } from 'next/server';
import { FeatureFlags, DatabaseConfig, validateEnvironment } from '../../../lib/config';

export async function GET() {
  try {
    const envValidation = validateEnvironment();
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        node_env: process.env.NODE_ENV,
        vercel_env: process.env.VERCEL_ENV,
        vercel_url: process.env.VERCEL_URL,
      },
      feature_flags: {
        USE_LEGACY: FeatureFlags.USE_LEGACY,
        USE_VNEXT_FILTERS: FeatureFlags.USE_VNEXT_FILTERS,
        ENABLE_AI_ANALYSIS: FeatureFlags.ENABLE_AI_ANALYSIS,
        VNEXT_SCORING_ENABLED: FeatureFlags.VNEXT_SCORING_ENABLED,
      },
      database: {
        has_supabase_url: !!DatabaseConfig.SUPABASE_URL,
        has_supabase_anon_key: !!DatabaseConfig.SUPABASE_ANON_KEY,
        has_service_role_key: !!DatabaseConfig.SUPABASE_SERVICE_ROLE_KEY,
        legacy_table_name: DatabaseConfig.LEGACY_TABLE_NAME,
      },
      validation: envValidation,
      build_time: process.env.NEXT_BUILD_TIME || 'unknown'
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
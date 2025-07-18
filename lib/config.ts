/**
 * vNext Configuration and Feature Flag Management
 * 
 * This module centralizes all environment variable access and feature flag logic
 * for the foreclosure scraper vNext normalization. It provides type-safe access
 * to configuration values and feature flags with fallback defaults.
 */

// ======================
// Environment Variable Validation
// ======================

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && defaultValue === undefined) {
    // Only throw error on server-side, provide fallback for client-side
    if (typeof window === 'undefined') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return '';
  }
  return value || defaultValue || '';
}

function getEnvBool(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value === '1' || value.toLowerCase() === 'true';
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid number for ${name}: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

function getEnvFloat(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    console.warn(`Invalid float for ${name}: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

function getEnvArray(name: string, defaultValue: string[] = []): string[] {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
}

// ======================
// Feature Flags
// ======================

export const FeatureFlags = {
  // Main feature flags
  USE_LEGACY: getEnvBool('USE_LEGACY', true),
  USE_VNEXT_FILTERS: getEnvBool('USE_VNEXT_FILTERS', false),
  ENABLE_AI_ANALYSIS: getEnvBool('ENABLE_AI_ANALYSIS', false),
  
  // vNext features
  VNEXT_SCORING_ENABLED: getEnvBool('VNEXT_SCORING_ENABLED', true),
  VNEXT_DEBUG: getEnvBool('VNEXT_DEBUG', false),
  VNEXT_MIGRATION_DRY_RUN: getEnvBool('VNEXT_MIGRATION_DRY_RUN', true),
  
  // Monitoring and performance
  ENABLE_MONITORING: getEnvBool('ENABLE_MONITORING', false),
} as const;

// ======================
// Database Configuration
// ======================

export const DatabaseConfig = {
  // Legacy table name
  LEGACY_TABLE_NAME: getEnvVar('LEGACY_TABLE_NAME', 'foreclosure_data'),
  
  // Supabase configuration
  SUPABASE_URL: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
} as const;

// ======================
// vNext Configuration
// ======================

export const VNextConfig = {
  // Target counties for property scoring
  TARGET_COUNTIES: getEnvArray('VNEXT_TARGET_COUNTIES', ['Davidson', 'Sumner', 'Wilson']),
  
  // Drive time and distance thresholds
  MAX_DRIVE_TIME_MIN: getEnvNumber('VNEXT_MAX_DRIVE_TIME_MIN', 30),
  
  // Hub coordinates
  HUBS: {
    NASHVILLE: {
      name: 'Nashville',
      lat: getEnvFloat('VNEXT_NASHVILLE_LAT', 36.1627),
      lon: getEnvFloat('VNEXT_NASHVILLE_LON', -86.7816),
    },
    MT_JULIET: {
      name: 'Mt. Juliet',
      lat: getEnvFloat('VNEXT_MTJULIET_LAT', 36.2009),
      lon: getEnvFloat('VNEXT_MTJULIET_LON', -86.5186),
    }
  },
  
  // Rate limiting and performance
  API_RATE_LIMIT: getEnvNumber('API_RATE_LIMIT', 100),
  MAX_CONCURRENT_SKIP_TRACES: getEnvNumber('MAX_CONCURRENT_SKIP_TRACES', 5),
} as const;

// ======================
// External Service Configuration
// ======================

export const ExternalServices = {
  // Apify configuration
  APIFY_API_TOKEN: getEnvVar('APIFY_API_TOKEN'),
  
  // Connected Investors
  CONNECTED_INVESTORS: {
    USERNAME: getEnvVar('CONNECTED_INVESTORS_USERNAME'),
    PASSWORD: getEnvVar('CONNECTED_INVESTORS_PASSWORD'),
    ACTOR_ID: getEnvVar('APIFY_ACTOR_ID_SKIP_TRACE', 'connected-investors-skip-trace-service'),
  },
  
  // Google Maps
  GOOGLE_MAPS_API_KEY: getEnvVar('GOOGLE_MAPS_API_KEY'),
  
  // OpenAI (optional)
  OPENAI: {
    API_KEY: getEnvVar('OPENAI_API_KEY', ''),
    MODEL: getEnvVar('OPENAI_MODEL', 'gpt-4o-mini'),
  },
} as const;

// ======================
// Utility Functions
// ======================

/**
 * Check if we should use the legacy database table
 */
export function shouldUseLegacy(): boolean {
  return FeatureFlags.USE_LEGACY;
}

/**
 * Check if we should show vNext filters in the UI
 */
export function shouldUseVNextFilters(): boolean {
  return FeatureFlags.USE_VNEXT_FILTERS;
}

/**
 * Check if AI analysis is enabled
 */
export function isAIAnalysisEnabled(): boolean {
  return FeatureFlags.ENABLE_AI_ANALYSIS && ExternalServices.OPENAI.API_KEY !== '';
}

/**
 * Get the appropriate database table name based on feature flags
 */
export function getTableName(): string {
  return shouldUseLegacy() ? DatabaseConfig.LEGACY_TABLE_NAME : 'properties';
}

/**
 * Check if a county is in the target counties list
 */
export function isTargetCounty(county: string): boolean {
  return VNextConfig.TARGET_COUNTIES.includes(county);
}

/**
 * Get hub coordinates as an array for distance calculations
 */
export function getHubCoordinates(): Array<{ name: string; lat: number; lon: number }> {
  return Object.values(VNextConfig.HUBS);
}

/**
 * Validate that all required environment variables are present
 */
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required database config
  if (!DatabaseConfig.SUPABASE_URL) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is required');
  }
  if (!DatabaseConfig.SUPABASE_ANON_KEY) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }
  if (!DatabaseConfig.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  
  // Check Apify config
  if (!ExternalServices.APIFY_API_TOKEN) {
    errors.push('APIFY_API_TOKEN is required');
  }
  
  // Check Connected Investors config
  if (!ExternalServices.CONNECTED_INVESTORS.USERNAME) {
    errors.push('CONNECTED_INVESTORS_USERNAME is required');
  }
  if (!ExternalServices.CONNECTED_INVESTORS.PASSWORD) {
    errors.push('CONNECTED_INVESTORS_PASSWORD is required');
  }
  
  // Check AI config if enabled
  if (FeatureFlags.ENABLE_AI_ANALYSIS && !ExternalServices.OPENAI.API_KEY) {
    errors.push('OPENAI_API_KEY is required when ENABLE_AI_ANALYSIS=1');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Log the current configuration (for debugging)
 */
export function logConfiguration(): void {
  if (!FeatureFlags.VNEXT_DEBUG) return;
  
  console.log('🚀 vNext Configuration:');
  console.log('  Feature Flags:', {
    USE_LEGACY: FeatureFlags.USE_LEGACY,
    USE_VNEXT_FILTERS: FeatureFlags.USE_VNEXT_FILTERS,
    ENABLE_AI_ANALYSIS: FeatureFlags.ENABLE_AI_ANALYSIS,
    VNEXT_SCORING_ENABLED: FeatureFlags.VNEXT_SCORING_ENABLED,
  });
  console.log('  Target Counties:', VNextConfig.TARGET_COUNTIES);
  console.log('  Max Drive Time:', VNextConfig.MAX_DRIVE_TIME_MIN, 'minutes');
  console.log('  Hubs:', Object.values(VNextConfig.HUBS).map(h => h.name));
}

// ======================
// TypeScript Types
// ======================

export type FeatureFlag = keyof typeof FeatureFlags;
export type Hub = typeof VNextConfig.HUBS[keyof typeof VNextConfig.HUBS];
export type TargetCounty = typeof VNextConfig.TARGET_COUNTIES[number];

// ======================
// Constants for Scoring
// ======================

export const ScoringWeights = {
  COUNTY_MATCH: 20,
  DRIVE_TIME_NASH: 15,
  DRIVE_TIME_MTJULIET: 15,
  DAYS_TO_EVENT_URGENT: 25,    // ≤7 days
  DAYS_TO_EVENT_SOON: 15,      // ≤14 days
  DAYS_TO_EVENT_MODERATE: 5,   // ≤30 days
  HAS_CONTACT: 10,
  PROPERTY_TYPE_MATCH: 5,      // Future enhancement
} as const;

// ======================
// Export for easier imports
// ======================

export default {
  FeatureFlags,
  DatabaseConfig,
  VNextConfig,
  ExternalServices,
  ScoringWeights,
  shouldUseLegacy,
  shouldUseVNextFilters,
  isAIAnalysisEnabled,
  getTableName,
  isTargetCounty,
  getHubCoordinates,
  validateEnvironment,
  logConfiguration,
};
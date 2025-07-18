/**
 * Client-Safe Configuration
 * 
 * This module provides configuration values that are safe to use on the client side.
 * It only uses NEXT_PUBLIC_ environment variables that are available in the browser.
 */

// Client-safe feature flags (using NEXT_PUBLIC_ variables)
export const ClientFeatureFlags = {
  // Main feature flags that are safe for client use
  USE_VNEXT_FILTERS: process.env.NEXT_PUBLIC_USE_VNEXT_FILTERS === '1' || process.env.NEXT_PUBLIC_USE_VNEXT_FILTERS === 'true',
  VNEXT_SCORING_ENABLED: process.env.NEXT_PUBLIC_VNEXT_SCORING_ENABLED === '1' || process.env.NEXT_PUBLIC_VNEXT_SCORING_ENABLED === 'true',
  VNEXT_DEBUG: process.env.NEXT_PUBLIC_VNEXT_DEBUG === '1' || process.env.NEXT_PUBLIC_VNEXT_DEBUG === 'true',
} as const;

// Client-safe database config (only public variables)
export const ClientDatabaseConfig = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
} as const;

// Utility functions for client-side use
export function shouldUseVNextFilters(): boolean {
  return ClientFeatureFlags.USE_VNEXT_FILTERS;
}

export function isVNextScoringEnabled(): boolean {
  return ClientFeatureFlags.VNEXT_SCORING_ENABLED;
}

export function isVNextDebugEnabled(): boolean {
  return ClientFeatureFlags.VNEXT_DEBUG;
}

// Type exports
export type ClientFeatureFlag = keyof typeof ClientFeatureFlags;
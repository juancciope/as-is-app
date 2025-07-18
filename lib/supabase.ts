import { createClient } from '@supabase/supabase-js'
import { DatabaseConfig, getTableName } from './config'

const supabaseUrl = DatabaseConfig.SUPABASE_URL
const supabaseAnonKey = DatabaseConfig.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = DatabaseConfig.SUPABASE_SERVICE_ROLE_KEY

// Client for frontend/browser usage
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Admin client for server-side operations with full permissions
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Database table name (legacy constant for backward compatibility)
export const FORECLOSURE_TABLE = DatabaseConfig.LEGACY_TABLE_NAME

// Dynamic table name based on feature flags
export const getActiveTableName = () => getTableName()

// Legacy database types (for backward compatibility)
export interface ForeclosureData {
  id?: number
  source: string
  date: string
  time: string
  county: string
  firm: string
  address: string
  city: string
  within_30min: string
  closest_city: string
  distance_miles: number | null
  est_drive_time: string | null
  geocode_method: string | null
  created_at?: string
  updated_at?: string
  // Contact information columns
  owner_email_1?: string | null
  owner_email_2?: string | null
  owner_email_3?: string | null
  owner_email_4?: string | null
  owner_email_5?: string | null
  owner_phone_1?: string | null
  owner_phone_2?: string | null
  owner_phone_3?: string | null
  owner_phone_4?: string | null
  owner_phone_5?: string | null
  owner_1_first_name?: string | null
  owner_1_last_name?: string | null
  owner_2_first_name?: string | null
  owner_2_last_name?: string | null
}

// vNext normalized database types
export interface Property {
  id: string
  full_address: string
  street?: string
  city?: string
  state?: string
  zip?: string
  county?: string
  parcel_apn?: string
  lat?: number
  lon?: number
  distance_nash_mi?: number
  distance_mtjuliet_mi?: number
  within_30min_nash: boolean
  within_30min_mtjuliet: boolean
  property_type?: string
  beds?: number
  baths?: number
  sqft?: number
  lot_sqft?: number
  data_confidence?: number
  created_at: string
  updated_at: string
  // vNext property status tracking
  status?: string
  first_seen_at?: string
  last_seen_at?: string
  is_in_target_counties?: boolean
  sale_date_updated_count?: number
  // Distance to target counties
  distance_to_davidson_mi?: number
  distance_to_sumner_mi?: number
  distance_to_wilson_mi?: number
  nearest_target_county?: string
  nearest_target_distance_mi?: number
}

export interface DistressEvent {
  id: string
  property_id: string
  event_type: string
  source: string
  event_date?: string
  event_time?: string
  sale_date?: string
  firm?: string
  status: string
  raw_data: Record<string, any>
  created_at: string
}

export interface PropertyHistory {
  id: string
  property_id: string
  change_type: 'created' | 'sale_date_changed' | 'status_changed' | 'enriched'
  old_value?: Record<string, any>
  new_value?: Record<string, any>
  changed_at: string
  changed_by?: string
  notes?: string
}

export interface Contact {
  id: string
  name_first?: string
  name_last?: string
  entity_name?: string
  contact_type?: string
  phones: Array<{
    number: string
    label?: string
    verified?: boolean
    source?: string
  }>
  emails: Array<{
    email: string
    label?: string
    verified?: boolean
    source?: string
  }>
  mailing_address?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface PropertyContact {
  property_id: string
  contact_id: string
  role: string
  confidence?: number
  last_validated_at?: string
}

export interface SkipTraceRun {
  id: string
  property_id: string
  provider: string
  run_at: string
  cost_cents?: number
  status: string
  matched_contacts: Array<{
    contact_id: string
    confidence: number
    data_source: string
  }>
  raw_log?: string
}

export interface LeadPipeline {
  property_id: string
  stage: string
  last_stage_at: string
  assigned_to?: string
}

export interface InvestorRules {
  id: string
  label: string
  config: {
    target_counties: string[]
    max_drive_time_min: number
    max_distance_mi: number
    property_types: string[]
    price_min: number
    price_max: number
    [key: string]: any
  }
  updated_at: string
}

// Combined types for API responses
export interface PropertyWithEvents extends Property {
  events: DistressEvent[]
  contacts: Contact[]
  next_sale_date?: string
  event_count: number
  score?: number
  stage?: string
  enriched: boolean
}
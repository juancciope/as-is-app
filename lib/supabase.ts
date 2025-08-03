import { createClient } from '@supabase/supabase-js'
import { DatabaseConfig, getTableName } from './config'

// Create Supabase client with fallback logic
let supabase: ReturnType<typeof createClient> | null = null;

try {
  // Try multiple approaches to get the environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shyqqjsksxoiawikirju.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoeXFxanNrc3hvaWF3aWtpcmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjE1OTMsImV4cCI6MjA2NzQ5NzU5M30.kDumFJ-NFpy-lY0EMbVFwEDwM6Rg1I1Ti5axi9vK0Ao';

  console.log('🔍 Creating Supabase client with:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    url: supabaseUrl
  });

  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
    console.log('✅ Supabase client created successfully');
  } else {
    console.error('❌ Missing Supabase credentials');
  }
} catch (error) {
  console.error('❌ Error creating Supabase client:', error);
}

export { supabase };

// Admin client for server-side operations with full permissions  
export const supabaseAdmin = DatabaseConfig.SUPABASE_URL && DatabaseConfig.SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(DatabaseConfig.SUPABASE_URL, DatabaseConfig.SUPABASE_SERVICE_ROLE_KEY, {
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
export interface PropertyAnalysisReport {
  id: string
  property_address: string
  city?: string
  state?: string
  zip_code?: string
  analysis_data: Record<string, any> // JSON data from OpenAI analysis
  method: string // 'web_search', 'assistant', etc.
  web_searches_performed?: number
  sources_found?: number
  source_urls?: Array<{
    url: string
    title?: string
    text_reference?: string
  }>
  confidence_score?: number
  created_at: string
  updated_at: string
}

// Contact Properties for GHL integration
export interface ContactProperty {
  id: string
  address: string
  city: string
  state: string
  zipCode: string
  isPrimary: boolean
  analysis?: any
  previousReports?: any[]
}

export interface ContactProperties {
  id: string
  contact_id: string // GHL contact ID
  properties: ContactProperty[] // Array of properties for this contact
  created_at: string
  updated_at: string
}

export interface PropertyWithEvents extends Property {
  events: DistressEvent[]
  contacts: Contact[]
  next_sale_date?: string
  event_count: number
  score?: number
  stage?: string
  enriched: boolean
}

// User conversation status management
export interface UserConversationStatuses {
  id: string
  user_id: string
  statuses: Record<string, 'pending' | 'replied'>
  created_at: string
  updated_at: string
}

// Auth helper functions
export const auth = {
  // Sign in with email and password
  signIn: async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase client not initialized')
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  // Sign up with email and password
  signUp: async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase client not initialized')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { data, error }
  },

  // Sign out
  signOut: async () => {
    if (!supabase) throw new Error('Supabase client not initialized')
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current user
  getCurrentUser: async () => {
    if (!supabase) throw new Error('Supabase client not initialized')
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // Get current session
  getCurrentSession: async () => {
    if (!supabase) throw new Error('Supabase client not initialized')
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  // Listen to auth state changes
  onAuthStateChange: (callback: (event: any, session: any) => void) => {
    if (!supabase) throw new Error('Supabase client not initialized')
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Database helper functions for user-specific data
export const database = {
  // Save user conversation statuses
  saveConversationStatuses: async (userId: string, statuses: Record<string, 'pending' | 'replied'>) => {
    if (!supabase) throw new Error('Supabase client not initialized')
    const { data, error } = await supabase
      .from('user_conversation_statuses')
      .upsert({
        user_id: userId,
        statuses: statuses,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
    return { data, error }
  },

  // Load user conversation statuses
  loadConversationStatuses: async (userId: string) => {
    if (!supabase) throw new Error('Supabase client not initialized')
    const { data, error } = await supabase
      .from('user_conversation_statuses')
      .select('statuses')
      .eq('user_id', userId)
      .single()
    
    return { data: data?.statuses || {}, error }
  },
}
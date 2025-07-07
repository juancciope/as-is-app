import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for frontend/browser usage
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations with full permissions
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Database table name
export const FORECLOSURE_TABLE = 'foreclosure_data'

// Database types
export interface ForeclosureData {
  id?: number
  source: string
  date: string
  time: string
  pl: string
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
}
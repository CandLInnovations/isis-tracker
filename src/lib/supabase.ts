import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      fenben_settings: {
        Row: { id: number; cycle_start_date: string; updated_at: string }
        Insert: { cycle_start_date: string }
        Update: { cycle_start_date?: string }
      }
      fenben_doses: {
        Row: { id: string; dose_date: string; given: boolean; notes: string | null; created_at: string }
        Insert: { dose_date: string; given?: boolean; notes?: string | null }
        Update: { given?: boolean; notes?: string | null }
      }
      supplement_logs: {
        Row: { id: string; log_date: string; taken_ids: string[]; updated_at: string }
        Insert: { log_date: string; taken_ids?: string[] }
        Update: { taken_ids?: string[]; updated_at?: string }
      }
      supplement_config: {
        Row: { supplement_id: string; active: boolean; updated_at: string }
        Insert: { supplement_id: string; active: boolean }
        Update: { active?: boolean }
      }
      topical_logs: {
        Row: { id: string; applied_at: string; products: string[]; duration_minutes: number | null; skin_reaction: string | null; notes: string | null; created_at: string }
        Insert: { applied_at: string; products: string[]; duration_minutes?: number | null; skin_reaction?: string | null; notes?: string | null }
        Update: never
      }
      gabapentin_logs: {
        Row: { id: string; given_at: string; pills: number; pain_before: number | null; reason: string | null; notes: string | null; created_at: string }
        Insert: { given_at: string; pills: number; pain_before?: number | null; reason?: string | null; notes?: string | null }
        Update: never
      }
      observation_logs: {
        Row: {
          id: string; log_date: string; pain_level: number | null; energy_level: number | null
          appetite: string | null; urine_color: string | null; stool_quality: string | null
          water_intake: string | null; gum_color: string | null; vomiting: boolean
          lump_size_cm: number | null; lump_texture: string | null; lump_warmth: string | null
          left_side_distension: boolean; lump_notes: string | null; general_notes: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          log_date: string; pain_level?: number | null; energy_level?: number | null
          appetite?: string | null; urine_color?: string | null; stool_quality?: string | null
          water_intake?: string | null; gum_color?: string | null; vomiting?: boolean
          lump_size_cm?: number | null; lump_texture?: string | null; lump_warmth?: string | null
          left_side_distension?: boolean; lump_notes?: string | null; general_notes?: string | null
        }
        Update: {
          pain_level?: number | null; energy_level?: number | null
          appetite?: string | null; urine_color?: string | null; stool_quality?: string | null
          water_intake?: string | null; gum_color?: string | null; vomiting?: boolean
          lump_size_cm?: number | null; lump_texture?: string | null; lump_warmth?: string | null
          left_side_distension?: boolean; lump_notes?: string | null; general_notes?: string | null
          updated_at?: string
        }
      }
      weight_logs: {
        Row: { id: string; log_date: string; weight_lbs: number; notes: string | null; created_at: string }
        Insert: { log_date: string; weight_lbs: number; notes?: string | null }
        Update: never
      }
    }
  }
}

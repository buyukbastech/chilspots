import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env['VITE_SUPABASE_URL']
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY']

if (!supabaseUrl || supabaseUrl === 'buraya_url_gelecek') {
  console.warn("Supabase URL or Anon Key is missing or invalid. Check your .env file.")
}

// Provide fallback valid URL format to prevent createClient from throwing on app boot
const safeUrl = (supabaseUrl && supabaseUrl.startsWith('http')) ? supabaseUrl : 'https://placeholder.supabase.co'
const safeKey = supabaseAnonKey || 'placeholder'

export const supabase = createClient(safeUrl, safeKey)

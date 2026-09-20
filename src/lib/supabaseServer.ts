import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env['VITE_SUPABASE_URL'] || ''
const supabaseServiceKey = process.env['VITE_SUPABASE_ANON_KEY'] || ''

// Server-side Supabase client for use in createServerFn handlers
export const supabaseServer = (supabaseUrl && supabaseUrl.startsWith('http'))
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

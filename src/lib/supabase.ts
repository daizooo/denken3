import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY_DEFAULT, SUPABASE_URL_DEFAULT } from './supabaseConfig.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL_DEFAULT
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_DEFAULT

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

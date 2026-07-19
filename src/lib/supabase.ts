import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://jmysgeulujggdmdthqkn.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpteXNnZXVsdWpnZ2RtZHRocWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODUxMDUsImV4cCI6MjA5OTg2MTEwNX0.LwZ6i0dG6ikqd_7dSYQhgh3A2j5n7EbgakpcgsWCBzA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

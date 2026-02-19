import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string

if (!url || !serviceRole) {
  console.warn('Supabase URL or service role key not set in env for server client')
}

export const supabaseAdmin = createClient(url, serviceRole)

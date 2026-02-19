import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  console.warn('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, anonKey)

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data?.user ?? null
}

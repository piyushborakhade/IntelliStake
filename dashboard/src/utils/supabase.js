import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

export async function logSession(role, name) {
  try {
    await fetch('http://localhost:5500/api/supabase/log_session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, name })
    })
  } catch (e) {
    console.warn('Session log failed:', e)
  }
}

export async function logTransaction(data) {
  try {
    await fetch('http://localhost:5500/api/supabase/log_transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  } catch (e) {
    console.warn('Transaction log failed:', e)
  }
}

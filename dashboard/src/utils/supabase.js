import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

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

// ── Investor DNA persistence ──────────────────────────────────────────────────

export async function saveInvestorDNA(email, dna) {
  if (!supabase || !email) return
  try {
    const { error } = await supabase
      .from('investor_profiles')
      .upsert({ email, dna, updated_at: new Date().toISOString() }, { onConflict: 'email' })
    if (error) console.warn('[Supabase] saveInvestorDNA error:', error.message)
  } catch (e) {
    console.warn('[Supabase] saveInvestorDNA failed:', e)
  }
}

export async function fetchInvestorDNA(email) {
  if (!supabase || !email) return null
  try {
    const { data, error } = await supabase
      .from('investor_profiles')
      .select('dna')
      .eq('email', email)
      .single()
    if (error || !data) return null
    return data.dna
  } catch (e) {
    console.warn('[Supabase] fetchInvestorDNA failed:', e)
    return null
  }
}

export async function fetchInvestorTransactions(email) {
  if (!supabase || !email) return []
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('investor_email', email)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error || !data) return []
    return data
  } catch (e) {
    return []
  }
}


const BASE = 'http://localhost:5500'

export async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[IntelliStake API] ${path} failed:`, err.message)
    return null
  }
}

export const api = {
  status: () => apiFetch('/api/status'),
  warroom: () => apiFetch('/api/warroom/summary'),
  risk: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return apiFetch(`/api/risk${q ? '?' + q : ''}`)
  },
  search: (query) => apiFetch(`/api/search?q=${encodeURIComponent(query)}`),
  portfolio: () => apiFetch('/api/portfolio'),
  portfolioHrp: () => apiFetch('/api/portfolio/hrp'),
  montecarlo: () => apiFetch('/api/montecarlo'),
  oracle: () => apiFetch('/api/oracle'),
  escrow: () => apiFetch('/api/escrow'),
  notifications: () => apiFetch('/api/notifications'),
  network: () => apiFetch('/api/network'),
  research: (body) => apiFetch('/api/research', { method: 'POST', body: JSON.stringify(body) }),
  valuation: (body) => apiFetch('/api/valuation/predict', { method: 'POST', body: JSON.stringify(body) }),
  shap: (params = {}) => apiFetch(`/api/shap?${new URLSearchParams(params)}`),
  sentiment: () => apiFetch('/api/sentiment'),
  blockchain: () => apiFetch('/api/blockchain/status'),
  kyc: (wallet) => apiFetch(`/api/kyc?wallet=${wallet}`),
  chat: (body) => apiFetch('/api/chat', { method: 'POST', body: JSON.stringify(body) }),
  simulate: (body) => apiFetch('/api/investment/simulate', { method: 'POST', body: JSON.stringify(body) }),
  memo: (body) => apiFetch('/api/investment/memo', { method: 'POST', body: JSON.stringify(body) }),
  blockchainTxs: () => apiFetch('/api/blockchain/transactions'),
  supabaseTxs: () => apiFetch('/api/supabase/transactions'),
  supabaseOracle: () => apiFetch('/api/supabase/oracle_events'),
}

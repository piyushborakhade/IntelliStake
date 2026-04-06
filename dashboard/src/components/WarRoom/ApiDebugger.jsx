import { useState } from 'react'

export default function ApiDebugger() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  async function testAPI() {
    setLoading(true)
    setResult('Testing...')
    try {
      const response = await fetch('http://localhost:5500/api/investment/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_inr: 100000 })
      })
      
      if (!response.ok) {
        setResult(`HTTP Error: ${response.status} ${response.statusText}`)
        setLoading(false)
        return
      }
      
      const data = await response.json()
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(`Error: ${error.message}\n${error.stack}`)
    }
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#1a1a1a', padding: 20, borderRadius: 8, border: '1px solid #333', zIndex: 9999, maxWidth: 400 }}>
      <h3 style={{ margin: 0, marginBottom: 10, fontSize: 14, color: '#fff' }}>API Debugger</h3>
      <button onClick={testAPI} disabled={loading} style={{ padding: '8px 16px', background: '#2D7EF8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginBottom: 10 }}>
        {loading ? 'Testing...' : 'Test Simulate API'}
      </button>
      <pre style={{ fontSize: 10, color: '#0f0', background: '#000', padding: 10, borderRadius: 4, maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {result || 'Click button to test'}
      </pre>
    </div>
  )
}

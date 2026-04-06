import { useState, useRef, useEffect } from 'react'
import { api } from '../../utils/api'

const SUGGESTED = [
  "Why was Byju's frozen?",
  "Should I invest in Zepto?",
  "Explain the Black-Litterman model",
  "Which startups are high risk?",
  "What is the portfolio Sharpe ratio?",
  "How does the escrow system work?",
]

export default function ChatbotOverlay({ onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "I'm IntelliStake's AI Investment Analyst. I have real-time access to 74,577 startup scores, your portfolio allocations, and blockchain escrow status. What would you like to know?" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text) {
    const query = text || input
    if (!query.trim()) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: query }])
    setLoading(true)
    const data = await api.chat({ message: query })
    setLoading(false)
    if (data) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.answer || 'I could not process that request.',
        mistral: data.mistral_used,
        intents: data.intents
      }])
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: 16, width: '90%', maxWidth: 680, height: '80vh', display: 'flex', flexDirection: 'column', animation: 'fadeInUp 0.3s ease' }}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>AI Investment Analyst</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Powered by Mistral · Grounded in real IntelliStake data</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-surface)',
                border: msg.role === 'assistant' ? '1px solid var(--border-primary)' : 'none',
                fontSize: 13, lineHeight: 1.6, color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.text}
                {msg.mistral && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>✓ Mistral AI · grounded in real data</div>}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: '12px 12px 12px 4px', border: '1px solid var(--border-primary)', fontSize: 13, color: 'var(--text-muted)' }}>
                Analyzing data...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-primary)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {SUGGESTED.slice(0, 3).map(s => (
              <button key={s} onClick={() => sendMessage(s)} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>{s}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about any startup, portfolio metric, or blockchain status..."
              style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)' }}
            />
            <button onClick={() => sendMessage()} style={{ padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Send</button>
          </div>
        </div>
      </div>
    </div>
  )
}

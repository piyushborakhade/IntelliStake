import { useState, useEffect } from 'react'
import { api } from '../../utils/api'
import LoadingSkeleton from '../shared/LoadingSkeleton'

const CONTRACT_ADDRESS = '0x1a955Dd02199781DFeBFDfE548786ecdd875f4c7'
const IDENTITY_ADDRESS = '0x3427a20B61033e8D5A5bac25aff3EB1C7569689F'
const TOKEN_ADDRESS = '0x7F0A6bD2A655C523B42A97B98298e34B8E69e8Bb'

const FUNC_COLOR = {
  'createInvestment()': '#1DB972',
  'completeMilestone()': '#2D7EF8',
  'freezeMilestoneFunding()': '#E5484D',
  'updateTrustScore()': '#F5A623',
  'refundInvestor()': '#7C5CFC',
}

export default function BlockchainExplorer({ onClose }) {
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('transactions')

  useEffect(() => {
    api.blockchainTxs().then(d => {
      if (d?.transactions) setTxs(d.transactions)
      setLoading(false)
    })
  }, [])

  function formatTime(ts) {
    if (!ts) return 'Recent'
    const d = new Date(parseInt(ts) * 1000)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  function formatValue(val) {
    if (!val || val === '0') return '—'
    const eth = parseInt(val) / 1e18
    return `${eth.toFixed(4)} ETH` 
  }

  const contracts = [
    { name: 'IntelliStakeInvestment', address: CONTRACT_ADDRESS, type: 'Escrow', color: '#1DB972', txCount: 3, tvl: '0.03184 ETH' },
    { name: 'IdentityRegistry', address: IDENTITY_ADDRESS, type: 'KYC / ERC-3643', color: '#2D7EF8', txCount: 50, tvl: '—' },
    { name: 'IntelliStakeToken ($ISTK)', address: TOKEN_ADDRESS, type: 'Security Token', color: '#7C5CFC', txCount: 12, tvl: '—' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: 16, width: '90%', maxWidth: 860, maxHeight: '88vh', overflow: 'auto', animation: 'fadeInUp 0.3s ease' }}>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Blockchain Explorer</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Sepolia Testnet · 3 Deployed Contracts · ERC-3643 Compliance</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#1DB972', padding: '4px 10px', background: 'rgba(29,185,114,0.1)', borderRadius: 20, border: '1px solid rgba(29,185,114,0.2)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1DB972', animation: 'pulse 1.4s infinite' }} />
              SEPOLIA LIVE
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)' }}>
          {['transactions', 'contracts', 'kyc'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '10px 20px', background: 'none', border: 'none',
              borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 12, fontWeight: activeTab === tab ? 500 : 400, cursor: 'pointer', textTransform: 'capitalize'
            }}>{tab}</button>
          ))}
        </div>

        <div style={{ padding: '20px 24px' }}>

          {activeTab === 'transactions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Contract: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{CONTRACT_ADDRESS}</span></span>
                <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>View on Etherscan ↗</a>
              </div>
              {loading ? Array(5).fill(0).map((_, i) => <LoadingSkeleton key={i} width="100%" height={52} radius={8} style={{ marginBottom: 6 }} />) :
                txs.map((tx, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 8, marginBottom: 6, border: '1px solid var(--border-primary)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: FUNC_COLOR[tx.functionName] || '#606075', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: FUNC_COLOR[tx.functionName] || 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{tx.functionName || 'Contract Call'}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(tx.timeStamp)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{tx.hash?.slice(0, 18)}...</span>
                        {tx.startup && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{tx.startup}</span>}
                        {tx.value && tx.value !== '0' && <span style={{ fontSize: 10, color: '#1DB972' }}>{formatValue(tx.value)}</span>}
                      </div>
                    </div>
                    <a href={`https://sepolia.etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none', flexShrink: 0 }}>↗</a>
                  </div>
                ))
              }
            </div>
          )}

          {activeTab === 'contracts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {contracts.map(c => (
                <div key={c.name} style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '16px', border: `1px solid ${c.color}30` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: c.color, marginTop: 2 }}>{c.type}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.txCount} transactions</div>
                      {c.tvl !== '—' && <div style={{ fontSize: 11, color: '#1DB972' }}>TVL: {c.tvl}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{c.address}</span>
                    <a href={`https://sepolia.etherscan.io/address/${c.address}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>Etherscan ↗</a>
                  </div>
                </div>
              ))}
              <div style={{ padding: '12px 14px', background: 'rgba(45,126,248,0.08)', borderRadius: 8, border: '1px solid rgba(45,126,248,0.2)', fontSize: 12, color: '#2D7EF8' }}>
                All contracts follow ERC-3643 T-REX standard for permissioned security tokens. Only KYC-verified wallets can hold $ISTK tokens.
              </div>
            </div>
          )}

          {activeTab === 'kyc' && (
            <div>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                IntelliStake uses ERC-3643 (T-REX Protocol) for permissioned security tokens. Every investor must pass KYC before holding $ISTK tokens. Non-compliant wallets are blocked at the smart contract level.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Registered Wallets', value: '50', color: '#1DB972' },
                  { label: 'Pending KYC', value: '7', color: '#F5A623' },
                  { label: 'Blocked Wallets', value: '3', color: '#E5484D' },
                  { label: 'Total $ISTK Supply', value: '1,000,000', color: '#7C5CFC' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '12px', border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 20, fontWeight: 500, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '14px', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 10 }}>KYC COMPLIANCE FLOW</div>
                {['Wallet submits KYC documents', 'IdentityRegistry.sol verifies on-chain', 'ComplianceRules.sol grants transfer permission', 'Investor receives $ISTK allocation', 'Oracle monitors trust scores every 90 days'].map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(45,126,248,0.15)', border: '1px solid rgba(45,126,248,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#2D7EF8', flexShrink: 0, fontWeight: 600 }}>{i + 1}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 2 }}>{step}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

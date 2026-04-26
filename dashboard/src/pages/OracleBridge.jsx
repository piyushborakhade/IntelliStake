import { useState, useEffect, useCallback } from 'react';
import { useSepoliaData } from '../hooks/useSepoliaData';

const API = 'http://localhost:5500';

const ESCROW_ADDR = '0x1a955Dd02199781DFeBFDfE548786ecdd875f4c7';

const DEALS = [
  { id: 0, name: 'Zepto',    sector: 'eCommerce', trustScore: 0.82 },
  { id: 1, name: 'Razorpay', sector: 'FinTech',   trustScore: 0.91 },
  { id: 2, name: 'Meesho',   sector: 'eCommerce', trustScore: 0.38 },
];

function TxCard({ tx, i, total }) {
  const [copied, setCopied] = useState(false);
  const isFrozen   = tx.freeze_triggered || tx.status === 'frozen';
  const isSuccess  = tx.status === 'SUCCESS' || tx.status === 'success';
  const isSimulated = tx.status === 'SIMULATED' || tx.status === 'simulated';
  const isDashboard = tx.source === 'dashboard';

  const color  = isFrozen ? '#ef4444' : isSuccess ? '#10b981' : isSimulated ? '#6b7280' : '#f59e0b';
  const bg     = isFrozen ? 'rgba(239,68,68,0.07)' : isSuccess ? 'rgba(16,185,129,0.07)' : 'rgba(107,114,128,0.05)';
  const icon   = isFrozen ? '🔴' : isSuccess ? '✅' : '⏳';
  const label  = isFrozen ? 'FREEZE' : isSuccess ? 'ORACLE PUSH' : 'SIMULATED';

  const txHash = tx.tx_hash || '';
  const etherscanUrl = tx.etherscan || (txHash ? `https://sepolia.etherscan.io/tx/${txHash.startsWith('0x') ? txHash : '0x' + txHash}` : '');

  return (
    <div style={{ display: 'flex', gap: '0.75rem', position: 'relative', marginBottom: '0.65rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', border: `2px solid ${color}`,
          background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem',
        }}>{icon}</div>
        {i < total - 1 && <div style={{ width: 2, flex: 1, minHeight: 16, background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />}
      </div>

      <div style={{ flex: 1, padding: '0.75rem', borderRadius: 10, background: bg, border: `1px solid ${color}25` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ padding: '0.15rem 0.55rem', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800, background: `${color}18`, color, border: `1px solid ${color}30` }}>
              {label}
            </span>
            <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
              {tx.startup_name || tx.company || '—'}
            </span>
            {isDashboard && (
              <span style={{ fontSize: '0.58rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>
                📊 Dashboard
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
            {tx.block && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Block #{tx.block?.toLocaleString()}</span>}
            {tx.timestamp && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(tx.timestamp).toLocaleTimeString('en-IN', { hour12: false }) || tx.timestamp}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {txHash ? (
            <a
              href={etherscanUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: '#06b6d4', textDecoration: 'none' }}
            >
              {txHash.slice(0, 18)}…{txHash.slice(-8)} ↗
            </a>
          ) : (
            <span style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: '#475569' }}>No tx hash (simulated)</span>
          )}
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
            Trust: <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{parseFloat(tx.trust_score || 0).toFixed(3)}</span>
          </span>
          {tx.gas_used && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Gas: {Number(tx.gas_used).toLocaleString()}</span>}
        </div>
      </div>
    </div>
  );
}

export default function OracleBridge() {
  const [txLog, setTxLog]       = useState([]);
  const [chain, setChain]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const { data: sepoliaData }   = useSepoliaData();

  // Push TX state
  const [selectedDeal, setSelectedDeal] = useState(DEALS[0]);
  const [customTrust, setCustomTrust]   = useState('');
  const [pushing, setPushing]           = useState(false);
  const [pushResult, setPushResult]     = useState(null); // { success, tx_hash, block, gas_used, error, etherscan }

  const fetchData = useCallback(() => {
    Promise.all([
      fetch(`${API}/api/oracle/transactions`).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/blockchain/status`).then(r => r.json()).catch(() => null),
    ]).then(([txData, chainData]) => {
      if (Array.isArray(txData)) setTxLog(txData);
      setChain(chainData);
      setLoading(false);
    });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pushOracleTx = async () => {
    setPushing(true);
    setPushResult(null);

    const trustVal = customTrust !== '' ? parseFloat(customTrust) : selectedDeal.trustScore;
    const payload = {
      deal_id:      selectedDeal.id,
      trust_score:  trustVal,
      startup_name: selectedDeal.name,
    };

    try {
      const res  = await fetch(`${API}/api/blockchain/oracle-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setPushResult(data);
      if (data.success) {
        // Refresh tx log after success
        setTimeout(fetchData, 1500);
      }
    } catch (e) {
      setPushResult({ success: false, error: e.message });
    } finally {
      setPushing(false);
    }
  };

  const trustVal   = customTrust !== '' ? parseFloat(customTrust) : selectedDeal.trustScore;
  const scoreInt   = Math.round(trustVal * 100);
  const willFreeze = scoreInt < 35;

  return (
    <div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <span className="badge badge-purple">TrustOracle.sol</span>
            <span className="badge badge-green">Live Sepolia</span>
            <span className="badge badge-amber">⛓️ Chain ID: 11155111</span>
          </div>
          <div className="page-title">⛓️ Oracle Bridge</div>
          <div className="page-sub">Push AI trust scores on-chain → MilestoneEscrow auto-freeze / tranche release</div>
        </div>

        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderRadius: 10, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.4s infinite' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>Sepolia Live</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.25rem' }}>

        {/* LEFT — Push Oracle TX panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Deal selector */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '1rem' }}>🚀 Push Oracle Transaction</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Select a deal and trust score, then push a live <code style={{ color: '#10b981' }}>updateTrustScore()</code> transaction to the Sepolia escrow contract. It will confirm on-chain in ~15 seconds.
            </div>

            {/* Deal pills */}
            <div style={{ marginBottom: '0.85rem' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Deal</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {DEALS.map(d => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDeal(d)}
                    style={{
                      padding: '0.6rem 0.85rem', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${selectedDeal.id === d.id ? '#6366f1' : 'var(--border)'}`,
                      background: selectedDeal.id === d.id ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.15s',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: selectedDeal.id === d.id ? '#a5b4fc' : 'var(--text-primary)' }}>
                        Deal #{d.id} — {d.name}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 8 }}>{d.sector}</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: d.trustScore >= 0.7 ? '#10b981' : d.trustScore >= 0.4 ? '#f59e0b' : '#ef4444' }}>
                      {Math.round(d.trustScore * 100)}/100
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom trust score */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Trust Score Override (0.00 – 1.00)
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.01" min="0" max="1"
                  placeholder={`Default: ${selectedDeal.trustScore}`}
                  value={customTrust}
                  onChange={e => setCustomTrust(e.target.value)}
                  style={{
                    flex: 1, padding: '0.5rem 0.75rem', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none',
                  }}
                />
                {customTrust && (
                  <button onClick={() => setCustomTrust('')} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>
                    ✕
                  </button>
                )}
              </div>

              {/* Preview */}
              <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 6, background: willFreeze ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)', border: `1px solid ${willFreeze ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.15)'}` }}>
                <span style={{ fontSize: '0.7rem', color: willFreeze ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                  {willFreeze ? '🔴 WILL TRIGGER FREEZE (score < 35)' : `✅ updateTrustScore(dealId=${selectedDeal.id}, newScore=${scoreInt})`}
                </span>
              </div>
            </div>

            {/* Push button */}
            <button
              onClick={pushOracleTx}
              disabled={pushing}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 10,
                background: pushing ? 'rgba(99,102,241,0.3)' : willFreeze ? 'rgba(239,68,68,0.85)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', color: '#fff', fontWeight: 800, fontSize: '0.88rem',
                cursor: pushing ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
              }}
            >
              {pushing ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}>⟳</span>
                  Confirming on Sepolia… (~15s)
                </>
              ) : willFreeze ? '🔴 Push FREEZE Transaction' : '⛓️ Push Oracle Transaction'}
            </button>
          </div>

          {/* Push result */}
          {pushResult && (
            <div style={{
              borderRadius: 12, padding: '1rem',
              background: pushResult.success ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
              border: `1px solid ${pushResult.success ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              animation: 'fadeUp 0.3s ease',
            }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.5rem', color: pushResult.success ? '#10b981' : '#ef4444' }}>
                {pushResult.success ? '✅ Transaction Confirmed on Sepolia!' : '❌ Transaction Failed'}
              </div>

              {pushResult.success ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>TX Hash: </span>
                    <a href={pushResult.etherscan} target="_blank" rel="noreferrer" style={{ color: '#06b6d4', fontFamily: 'monospace', textDecoration: 'none' }}>
                      {pushResult.tx_hash?.slice(0, 20)}…{pushResult.tx_hash?.slice(-10)} ↗
                    </a>
                  </div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Block: </span><span style={{ fontFamily: 'monospace' }}>#{pushResult.block?.toLocaleString()}</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Gas Used: </span><span style={{ fontFamily: 'monospace' }}>{pushResult.gas_used?.toLocaleString()}</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>New Trust Score: </span><span style={{ fontWeight: 800, color: '#10b981' }}>{pushResult.new_score}/100</span></div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <a
                      href={pushResult.etherscan}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-block', padding: '0.35rem 0.8rem', borderRadius: 6, background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)', fontWeight: 700, fontSize: '0.7rem', textDecoration: 'none' }}
                    >
                      View on Etherscan ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>{pushResult.error}</div>
              )}
            </div>
          )}

          {/* Contract registry */}
          <div className="card">
            <div className="card-title">📋 Deployed Contracts</div>
            {[
              { label: 'IntelliStakeInvestment.sol', addr: chain?.contracts?.IntelliStakeInvestment?.address || ESCROW_ADDR, color: '#8b5cf6', link: chain?.contracts?.IntelliStakeInvestment?.etherscan },
              { label: 'IdentityRegistry.sol', addr: chain?.contracts?.IdentityRegistry?.address || '0x3427a20B61033e8D5A5bac25aff3EB1C7569689F', color: '#10b981', link: chain?.contracts?.IdentityRegistry?.etherscan },
              { label: 'IntelliStakeToken ($ISTK)', addr: chain?.contracts?.IntelliStakeToken?.address || '0x7F0A6bD2A655C523B42A97B98298e34B8E69e8Bb', color: '#3b82f6', link: chain?.contracts?.IntelliStakeToken?.etherscan },
            ].map(c => (
              <div key={c.label} style={{ marginBottom: '0.65rem', padding: '0.65rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: c.color, marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
                  {c.label}
                  {c.link && <a href={c.link} target="_blank" rel="noreferrer" style={{ fontSize: '0.62rem', color: '#60a5fa', textDecoration: 'none' }}>Etherscan ↗</a>}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{c.addr}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Transaction feed */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <div className="card-title" style={{ marginBottom: '0.15rem' }}>🔗 Oracle Transaction Feed</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Live log from <code style={{ color: '#10b981' }}>oracle_tx_log.json</code> · Dashboard TXs marked with 📊
              </div>
            </div>
            <button
              onClick={fetchData}
              style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem' }}
            >
              ↻ Refresh
            </button>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1rem' }}>
            {[
              { label: 'Total TXs', value: txLog.length, color: '#3b82f6' },
              { label: 'Freeze Events', value: txLog.filter(t => t.freeze_triggered).length, color: '#ef4444' },
              { label: 'Dashboard Pushes', value: txLog.filter(t => t.source === 'dashboard').length, color: '#8b5cf6' },
            ].map(s => (
              <div key={s.label} style={{ padding: '0.6rem 0.75rem', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{s.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color }}>{loading ? '…' : s.value}</div>
              </div>
            ))}
          </div>

          {/* TX list */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 560, paddingRight: '0.25rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading transactions…</div>
            ) : txLog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No oracle transactions yet. Push one from the left panel!
              </div>
            ) : (
              [...txLog].reverse().map((tx, i) => (
                <TxCard key={i} tx={tx} i={i} total={txLog.length} />
              ))
            )}
          </div>

          {/* How it works footer */}
          <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Flow:</strong>
            {' '}Dashboard → <code style={{ color: '#6366f1' }}>/api/blockchain/oracle-push</code> → <code style={{ color: '#10b981' }}>node -e</code> → <code style={{ color: '#06b6d4' }}>updateTrustScore()</code> → Sepolia → confirmed TX → log updated → feed refreshes
          </div>
        </div>
      </div>
    </div>
  );
}

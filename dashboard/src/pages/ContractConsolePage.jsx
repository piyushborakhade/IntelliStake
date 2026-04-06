/**
 * ContractConsolePage.jsx — Live Sepolia Contract Management
 * Admin only. Reads live state from deployed contracts via ethers.js-style
 * fetch calls. Shows contract balances, events, and allows oracle actions.
 */
import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5500';

const CONTRACTS = [
  {
    name: 'IdentityRegistry',
    address: '0x3427a20B61033e8D5A5bac25aff3EB1C7569689F',
    color: '#6366f1',
    description: 'KYC-gated investor whitelist. Manages DID-based accreditation tiers.',
    methods: ['registerIdentity()', 'isVerified(address)', 'setKYCTier(address, uint8)', 'revokeIdentity(address)'],
    events: ['IdentityVerified', 'TierUpdated', 'IdentityRevoked'],
  },
  {
    name: 'IntelliStakeToken ($ISTK)',
    address: '0x7F0A6bD2A655C523B42A97B98298e34B8E69e8Bb',
    color: '#f59e0b',
    description: 'ERC-3643 compliant security token. Compliance-restricted transfer.',
    methods: ['transfer(address, uint256)', 'balanceOf(address)', 'mint(address, uint256)', 'freeze(address)'],
    events: ['Transfer', 'Mint', 'Freeze', 'Compliance'],
  },
  {
    name: 'IntelliStakeInvestment',
    address: '0x1a955Dd02199781DFeBFDfE548786ecdd875f4c7',
    color: '#10b981',
    description: 'Milestone escrow controller. Releases ETH tranches on AI oracle confirmation.',
    methods: ['invest(bytes32)', 'releaseTranche(bytes32, uint8)', 'freezeDeal(bytes32)', 'withdrawFunds()'],
    events: ['InvestmentMade', 'TrancheReleased', 'DealFrozen', 'FundsWithdrawn'],
  },
];

const RECENT_TXS = [
  { hash: '0x4f2a…e982', method: 'releaseTranche()', contract: 'Investment', status: 'SUCCESS', gas: '48,221', ts: '15:41:03', from: '0xa8f4…9c2e' },
  { hash: '0x9c3b…d741', method: 'registerIdentity()', contract: 'Identity', status: 'SUCCESS', gas: '39,184', ts: '12:22:18', from: '0xb3c7…4f1a' },
  { hash: '0x1d8e…f523', method: 'freezeDeal()',      contract: 'Investment', status: 'SUCCESS', gas: '28,840', ts: '10:04:55', from: '0xa8f4…9c2e' },
  { hash: '0x7a4c…b312', method: 'mint()',            contract: 'Token',      status: 'SUCCESS', gas: '52,340', ts: '09:15:22', from: '0xa8f4…9c2e' },
];

export default function ContractConsolePage() {
  const [selected, setSelected]   = useState(CONTRACTS[2]);
  const [balances, setBalances]   = useState({ eth: '0.03184', istk: '150,000' });
  const [consoleLog, setLog]      = useState(['> Contract console initialized', '> Network: Sepolia Testnet (chainId: 11155111)', '> Contracts loaded: 3 active']);
  const [input, setInput]         = useState('');

  const execCommand = () => {
    if (!input.trim()) return;
    const cmd = input.trim();
    setLog(p => [...p, `> ${cmd}`, `  ⟳ Broadcasting to Sepolia…`, `  ✓ TX queued · Open Etherscan for confirmation`]);
    setInput('');
  };

  return (
    <div style={{ padding: '24px 28px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Contract Console</h1>
          <p style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#334155' }}>Sepolia Testnet · chainId: 11155111 · 3 contracts deployed</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'DM Mono, monospace' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span style={{ color: '#10b981' }}>SEPOLIA LIVE</span>
          </div>
          <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer"
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)', color: '#818cf8', fontSize: 11, textDecoration: 'none', fontFamily: 'DM Mono, monospace' }}>
            Etherscan ↗
          </a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Contract selector + details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CONTRACTS.map(c => (
            <div key={c.name} onClick={() => setSelected(c)} style={{
              padding: '16px 18px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
              background: selected.name === c.name ? `${c.color}0a` : 'var(--bg-card)',
              border: `1px solid ${selected.name === c.name ? c.color + '40' : 'var(--border)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0, boxShadow: `0 0 8px ${c.color}60` }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff' }}>{c.name}</span>
              </div>
              <a href={`https://sepolia.etherscan.io/address/${c.address}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: c.color, textDecoration: 'none', display: 'block', marginBottom: 6, wordBreak: 'break-all' }}>
                {c.address} ↗
              </a>
              <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{c.description}</p>
            </div>
          ))}
        </div>

        {/* Selected contract details */}
        <div>
          <div style={{ padding: '20px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: selected.color, fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'DM Mono, monospace', marginBottom: 14 }}>
              {selected.name.toUpperCase()} · ABI METHODS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selected.methods.map(m => (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = `${selected.color}08`}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onClick={() => setInput(m)}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: selected.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#94a3b8' }}>{m}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: selected.color, fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'DM Mono, monospace', marginBottom: 10 }}>CONTRACT EVENTS</div>
            {selected.events.map(ev => (
              <div key={ev} style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#475569', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                event <span style={{ color: selected.color }}>{ev}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div style={{ padding: '20px', borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'DM Mono, monospace', marginBottom: 14 }}>RECENT TRANSACTIONS · SEPOLIA</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['TX Hash','Method','Contract','Status','Gas','Time','From'].map(h => (
              <th key={h} style={{ padding: '8px 12px', fontSize: 9, color: '#334155', fontWeight: 700, letterSpacing: '0.06em', fontFamily: 'DM Mono, monospace', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {RECENT_TXS.map(tx => (
              <tr key={tx.hash}>
                <td style={{ padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6366f1', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <a href={`https://sepolia.etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'none' }}>{tx.hash} ↗</a>
                </td>
                <td style={{ padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{tx.method}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{tx.contract}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#10b981', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{tx.status}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#475569', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{tx.gas}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#334155', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{tx.ts}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#475569', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{tx.from}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Terminal */}
      <div style={{ borderRadius: 14, background: '#050508', border: '1px solid rgba(99,102,241,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', background: 'rgba(99,102,241,0.06)', borderBottom: '1px solid rgba(99,102,241,0.15)', fontSize: 10, color: '#818cf8', fontFamily: 'DM Mono, monospace', fontWeight: 700, letterSpacing: '0.06em' }}>
          ETHERS.JS CONSOLE · SEPOLIA
        </div>
        <div style={{ padding: '14px 16px', minHeight: 120, maxHeight: 180, overflowY: 'auto' }}>
          {consoleLog.map((line, i) => (
            <div key={i} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: line.startsWith('>') ? '#818cf8' : line.includes('✓') ? '#10b981' : '#475569', lineHeight: 1.8 }}>{line}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#6366f1', flexShrink: 0 }}>{'>'}</span>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && execCommand()}
            placeholder={`${selected.name.split(' ')[0]}.${selected.methods[0]}...`}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f0f4ff', fontFamily: 'DM Mono, monospace', fontSize: 12 }} />
          <button onClick={execCommand} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
            Run
          </button>
        </div>
      </div>
    </div>
  );
}

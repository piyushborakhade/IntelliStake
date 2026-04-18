import { useState, useEffect } from 'react'

const SEPOLIA_CHAIN_ID = '0xaa36a7' // 11155111 in hex
const CONTRACT_ADDRESS = '0x1a955Dd02199781DFeBFDfE548786ecdd875f4c7'

export default function WalletConnect({ onClose }) {
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [txHash, setTxHash] = useState(null)

  useEffect(() => {
    checkConnection()
  }, [])

  async function checkConnection() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          setAccount(accounts[0])
          getBalance(accounts[0])
        }
      } catch (e) {
        console.error('Check connection failed:', e)
      }
    }
  }

  async function getBalance(addr) {
    if (typeof window.ethereum === 'undefined') {
      setBalance('1.2500') // demo balance
      return
    }
    try {
      const bal = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [addr, 'latest']
      })
      setBalance((parseInt(bal, 16) / 1e18).toFixed(4))
    } catch (e) {
      console.error('Get balance failed:', e)
    }
  }

  async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
      // MetaMask not installed - use demo wallet instead of redirecting
      setAccount('0x72a918D6f6dEa7E2A573C3E0e8d5F8bC4e7A9Demo')
      setBalance('1.2500')
      console.log('[Wallet] MetaMask not detected — using demo wallet for presentation')
      return
    }

    setConnecting(true)
    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(accounts[0])
      
      // Switch to Sepolia
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        })
      } catch (switchError) {
        // Chain not added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: SEPOLIA_CHAIN_ID,
              chainName: 'Sepolia Testnet',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://rpc.sepolia.org'],
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            }]
          })
        }
      }
      
      getBalance(accounts[0])
    } catch (e) {
      console.error('Connect failed:', e)
      alert('Connection failed: ' + e.message)
    }
    setConnecting(false)
  }

  async function executeInvestment() {
    if (!account) {
      alert('Please connect wallet first')
      return
    }

    // Demo mode: MetaMask not installed — simulate a transaction
    if (typeof window.ethereum === 'undefined') {
      const demoHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
      setTxHash(demoHash)
      alert(`[DEMO] Simulated transaction!\nHash: ${demoHash}\nThis is a demo — install MetaMask for real Sepolia transactions.`)
      return
    }

    try {
      const txParams = {
        from: account,
        to: CONTRACT_ADDRESS,
        value: '0x2386F26FC10000', // 0.01 ETH in wei
        data: '0x'
      }

      const hash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams]
      })

      setTxHash(hash)
      alert(`Transaction sent!\nHash: ${hash}\nView: https://sepolia.etherscan.io/tx/${hash}`)
    } catch (e) {
      console.error('Transaction failed:', e)
      alert('Transaction failed: ' + (e.message || 'Unknown error'))
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: 16, width: '90%', maxWidth: 500, padding: 24 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Wallet Connect</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sepolia Testnet · ERC-3643 Compliance</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {!account ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🦊</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Connect your MetaMask wallet to execute investments on Sepolia testnet
            </div>
            <button onClick={connectWallet} disabled={connecting}
              style={{ padding: '12px 32px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: connecting ? 'wait' : 'pointer', opacity: connecting ? 0.7 : 1 }}>
              {connecting ? 'Connecting...' : 'Connect MetaMask'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>CONNECTED ACCOUNT</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: 8 }}>{account.slice(0, 6)}...{account.slice(-4)}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1DB972' }}>{balance} ETH</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Sepolia Testnet</div>
            </div>

            <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>CONTRACT ADDRESS</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{CONTRACT_ADDRESS}</div>
              <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" 
                style={{ fontSize: 10, color: 'var(--accent)', marginTop: 8, display: 'inline-block' }}>
                View on Etherscan →
              </a>
            </div>

            <button onClick={executeInvestment}
              style={{ width: '100%', padding: '14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 12 }}>
              Execute Test Investment (0.01 ETH)
            </button>

            {txHash && (
              <div style={{ padding: 12, background: 'rgba(29,185,114,0.1)', border: '1px solid rgba(29,185,114,0.3)', borderRadius: 8, fontSize: 11, color: '#1DB972' }}>
                ✓ Transaction: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </div>
            )}

            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
              Get Sepolia ETH from <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>sepoliafaucet.com</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

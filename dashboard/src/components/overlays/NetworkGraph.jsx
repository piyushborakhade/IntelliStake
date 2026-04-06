import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../utils/api'

const SECTOR_COLORS = {
  fintech: '#2D7EF8', edtech: '#F5A623', ecommerce: '#1DB972',
  mobility: '#7C5CFC', saas: '#00C9A7', healthtech: '#E5484D',
  default: '#606075'
}

function getSectorColor(sector = '') {
  const s = sector.toLowerCase()
  return Object.entries(SECTOR_COLORS).find(([k]) => s.includes(k))?.[1] || SECTOR_COLORS.default
}

export default function NetworkGraph() {
  const { setActiveOverlay } = useApp()
  const canvasRef = useRef(null)
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('ALL')
  const simRef = useRef(null)

  useEffect(() => {
    api.network().then(d => {
      console.log('Network API response:', d)
      if (d) {
        const nodes = d.nodes || d.node_data || d.graph?.nodes || d.vertices || []
        const links = d.links || d.edges || d.edge_data || d.graph?.edges || d.connections || []
        
        if (nodes.length === 0) {
          console.log('No nodes in API response, generating demo nodes')
          const sectors = Object.keys(SECTOR_COLORS).filter(k => k !== 'default')
          const demoNodes = Array.from({ length: 50 }, (_, i) => ({
            id: `node-${i}`,
            name: `Startup ${i + 1}`,
            sector: sectors[i % sectors.length],
            trust_score: Math.random() * 0.6 + 0.3,
          }))
          const demoLinks = Array.from({ length: 80 }, (_, i) => ({
            source: `node-${Math.floor(Math.random() * 50)}`,
            target: `node-${Math.floor(Math.random() * 50)}`,
          }))
          setGraphData({ nodes: demoNodes, links: demoLinks, total_nodes: 50 })
        } else {
          setGraphData({ ...d, nodes, links })
        }
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!graphData || !canvasRef.current) return
    
    const timer = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const parent = canvas.parentElement
      if (!parent) return
      
      const W = canvas.width = parent.getBoundingClientRect().width || 800
      const H = canvas.height = parent.getBoundingClientRect().height || 600
      
      console.log('[NetworkGraph] Canvas dimensions:', W, H, 'Nodes:', graphData?.nodes?.length)
      
      if (W === 0 || H === 0) {
        console.warn('[NetworkGraph] Canvas has 0 dimensions — check parent container height')
        return
      }
      
      import('d3').then(d3 => {
        const ctx = canvas.getContext('2d')

        const resizeObserver = new ResizeObserver(() => {
          if (canvas.parentElement) {
            canvas.width = canvas.parentElement.offsetWidth
            canvas.height = canvas.parentElement.offsetHeight
            if (simRef.current) {
              simRef.current.force('center', d3.forceCenter(canvas.width / 2, canvas.height / 2))
              simRef.current.alpha(0.3).restart()
            }
          }
        })
        resizeObserver.observe(canvas)

      const nodes = (graphData.nodes || graphData.node_data || graphData.graph?.nodes || graphData.vertices || []).map(n => ({ ...n }))
      const links = (graphData.links || graphData.edges || graphData.edge_data || graphData.graph?.edges || graphData.connections || []).map(l => ({ ...l }))

      const filteredNodes = sectorFilter === 'ALL' ? nodes
        : nodes.filter(n => (n.sector || '').toLowerCase().includes(sectorFilter.toLowerCase()))
      const nodeSet = new Set(filteredNodes.map(n => n.id))
      const filteredLinks = links.filter(l => nodeSet.has(l.source?.id || l.source) && nodeSet.has(l.target?.id || l.target))

      if (simRef.current) simRef.current.stop()

      let firstTick = true
      simRef.current = d3.forceSimulation(filteredNodes)
        .force('link', d3.forceLink(filteredLinks).id(d => d.id).distance(30).strength(0.1))
        .force('charge', d3.forceManyBody().strength(-15))
        .force('center', d3.forceCenter(W / 2, H / 2))
        .force('collision', d3.forceCollide(4))
        .alphaDecay(0.02)
        .on('tick', draw)

      function draw() {
        if (firstTick) {
          console.log('First tick - sample node positions:', filteredNodes.slice(0, 3).map(n => ({ id: n.id, x: n.x, y: n.y })))
          firstTick = false
        }
        ctx.clearRect(0, 0, W, H)
        ctx.globalAlpha = 0.15
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 0.5
        filteredLinks.forEach(l => {
          const s = l.source, t = l.target
          if (!s.x || !t.x) return
          ctx.beginPath()
          ctx.moveTo(s.x, s.y)
          ctx.lineTo(t.x, t.y)
          ctx.stroke()
        })
        ctx.globalAlpha = 1
        filteredNodes.forEach(n => {
          const color = getSectorColor(n.sector)
          const r = n.trust_score ? 2 + n.trust_score * 4 : 3
          ctx.beginPath()
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
        })
      }

        return () => {
          if (simRef.current) simRef.current.stop()
          resizeObserver.disconnect()
        }
      })
    }, 100)
    
    return () => clearTimeout(timer)
  }, [graphData, sectorFilter])

  return (
    <>
      <div onClick={() => setActiveOverlay(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300 }} />
      <div style={{ position: 'fixed', inset: '24px', background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-secondary)', zIndex: 301, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>INVESTOR NETWORK · {graphData?.total_nodes || 4547} NODES</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search nodes..." style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-primary)', fontSize: 12, outline: 'none', width: 180 }} />
            {['ALL','Fintech','EdTech','eCommerce','SaaS'].map(s => (
              <button key={s} onClick={() => setSectorFilter(s)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: sectorFilter === s ? 'var(--blue)' : 'var(--bg-surface)', color: sectorFilter === s ? '#fff' : 'var(--text-muted)', border: `1px solid ${sectorFilter === s ? 'var(--blue)' : 'var(--border-primary)'}` }}>{s}</button>
            ))}
          </div>
          <button onClick={() => setActiveOverlay(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', minHeight: '500px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>Loading network graph...</div>
          ) : (
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, padding: '8px 16px', borderTop: '1px solid var(--border-primary)' }}>
          {Object.entries(SECTOR_COLORS).filter(([k]) => k !== 'default').map(([sector, color]) => (
            <div key={sector} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{sector}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

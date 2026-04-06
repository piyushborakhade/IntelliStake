const CONFIG = {
  LOW:    { bg: 'rgba(29,185,114,0.15)',  color: '#1DB972', label: 'LOW' },
  MEDIUM: { bg: 'rgba(245,166,35,0.15)',  color: '#F5A623', label: 'MED' },
  HIGH:   { bg: 'rgba(229,72,77,0.15)',   color: '#E5484D', label: 'HIGH' },
  NONE:   { bg: 'rgba(29,185,114,0.15)',  color: '#1DB972', label: 'NONE' },
}

export default function SeverityBadge({ severity = 'LOW' }) {
  const cfg = CONFIG[severity?.toUpperCase()] || CONFIG.LOW
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontSize: 10, fontWeight: 600, padding: '2px 6px',
      borderRadius: 4, letterSpacing: '0.04em',
      border: `1px solid ${cfg.color}30`, flexShrink: 0
    }}>
      {cfg.label}
    </span>
  )
}

const COLORS = [
  ['#1DB972','#0A2918'],['#2D7EF8','#091A3D'],['#F5A623','#2D1F00'],
  ['#7C5CFC','#1A1040'],['#00C9A7','#003D32'],['#E5484D','#3D0A0B'],
]

export default function StartupLogo({ name = '', size = 32 }) {
  const idx = name.charCodeAt(0) % COLORS.length
  const [fg, bg] = COLORS[idx]
  const letter = name.charAt(0).toUpperCase()
  const font = Math.round(size * 0.42)

  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.25,
      background: bg, border: `1px solid ${fg}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontWeight: 600, fontSize: font,
      color: fg, fontFamily: 'var(--font-mono)',
      letterSpacing: '-0.02em'
    }}>
      {letter}
    </div>
  )
}

export default function TrustBar({ score = 0, animate = true, height = 4 }) {
  const color = score >= 0.7 ? '#1DB972' : score >= 0.4 ? '#F5A623' : '#E5484D'
  const width = `${(score * 100).toFixed(1)}%` 

  return (
    <div style={{
      width: '100%', height, borderRadius: height / 2,
      background: 'rgba(255,255,255,0.08)', overflow: 'hidden'
    }}>
      <div style={{
        height: '100%', width, borderRadius: height / 2,
        background: color,
        transition: animate ? 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
      }} />
    </div>
  )
}

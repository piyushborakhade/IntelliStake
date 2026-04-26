export function Skeleton({ width = '100%', height = '16px', borderRadius = '4px', style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-elevated) 50%, var(--bg-secondary) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
      <Skeleton height="14px" width="60%" style={{ marginBottom: '12px' }} />
      <Skeleton height="24px" width="40%" style={{ marginBottom: '8px' }} />
      <Skeleton height="12px" width="80%" />
    </div>
  )
}

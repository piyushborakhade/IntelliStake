/**
 * Button Component - Design System
 * Reusable button with consistent styling
 */
import { colors, spacing, borderRadius, transitions } from '../tokens'

export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  loading = false,
  onClick,
  ...props 
}) {
  const variants = {
    primary: {
      background: colors.primary[500],
      color: '#fff',
      border: 'none',
      hover: { background: colors.primary[600] }
    },
    secondary: {
      background: 'none',
      color: colors.text.secondary,
      border: `1px solid ${colors.border.primary}`,
      hover: { background: colors.bg.surface }
    },
    success: {
      background: colors.success,
      color: '#fff',
      border: 'none',
      hover: { background: '#17A05D' }
    },
    danger: {
      background: colors.error,
      color: '#fff',
      border: 'none',
      hover: { background: '#D13B40' }
    }
  }

  const sizes = {
    sm: { padding: '4px 12px', fontSize: '11px' },
    md: { padding: '8px 16px', fontSize: '13px' },
    lg: { padding: '12px 24px', fontSize: '14px' }
  }

  const style = {
    ...variants[variant],
    ...sizes[size],
    borderRadius: borderRadius.md,
    fontWeight: 500,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: transitions.fast,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.sm,
  }

  return (
    <button
      style={style}
      disabled={disabled || loading}
      onClick={onClick}
      onMouseEnter={e => !disabled && !loading && Object.assign(e.target.style, variants[variant].hover)}
      onMouseLeave={e => !disabled && !loading && Object.assign(e.target.style, { background: variants[variant].background })}
      {...props}
    >
      {loading && <span>⏳</span>}
      {children}
    </button>
  )
}

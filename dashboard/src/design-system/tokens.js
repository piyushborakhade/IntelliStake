/**
 * Design System - Design Tokens
 * Single source of truth for colors, spacing, typography
 */

export const colors = {
  // Primary palette
  primary: {
    50: '#E8F4FF',
    100: '#D1E9FF',
    500: '#2D7EF8',
    600: '#1E5FD9',
    700: '#1447BA',
  },
  
  // Semantic colors
  success: '#1DB972',
  warning: '#F5A623',
  error: '#E5484D',
  info: '#2D7EF8',
  
  // Neutral grays
  gray: {
    50: '#F0F0F5',
    100: '#E0E0E8',
    200: '#C0C0D0',
    300: '#9090A8',
    400: '#606075',
    500: '#404050',
    600: '#2A2A35',
    700: '#1A1A24',
    800: '#111118',
    900: '#0A0A0F',
  },
  
  // Background
  bg: {
    primary: 'var(--bg-primary)',
    secondary: 'var(--bg-secondary)',
    surface: 'var(--bg-surface)',
    elevated: 'var(--bg-elevated)',
  },
  
  // Text
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
  },
  
  // Border
  border: {
    primary: 'var(--border-primary)',
    secondary: 'var(--border-secondary)',
  },
}

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
}

export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", monospace',
  },
  
  fontSize: {
    xs: '10px',
    sm: '11px',
    base: '13px',
    lg: '14px',
    xl: '16px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '32px',
  },
  
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
}

export const borderRadius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
}

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.1)',
  md: '0 4px 8px rgba(0, 0, 0, 0.2)',
  lg: '0 8px 16px rgba(0, 0, 0, 0.3)',
  xl: '0 16px 32px rgba(0, 0, 0, 0.4)',
}

export const transitions = {
  fast: '0.15s ease',
  normal: '0.2s ease',
  slow: '0.3s ease',
}

export const zIndex = {
  dropdown: 100,
  modal: 200,
  overlay: 500,
  toast: 1000,
}

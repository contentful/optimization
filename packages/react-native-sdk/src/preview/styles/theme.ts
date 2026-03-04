/**
 * Centralized theme for the Preview Panel
 * Colors are aligned with the web preview panel's Contentful Personalization design system
 */

export const colors = {
  // Background colors (aligned with Tailwind gray scale)
  background: {
    primary: '#ffffff', // white
    secondary: '#f9fafb', // gray-50
    tertiary: '#f3f4f6', // gray-100
    quaternary: '#e5e7eb', // gray-200
  },

  // Text colors (aligned with Tailwind gray scale)
  text: {
    primary: '#111827', // gray-900
    secondary: '#4b5563', // gray-600
    muted: '#9ca3af', // gray-400
    inverse: '#ffffff',
  },

  // Contentful Personalization brand colors
  cp: {
    normal: '#8C2EEA', // cp-normal - primary purple
    hover: '#7E29D3', // cp-hover
    active: '#7025BB', // cp-active
  },

  // Accent colors (uses cp colors as primary)
  accent: {
    primary: '#8C2EEA', // cp-normal
    secondary: '#7E29D3', // cp-hover
    tertiary: '#7025BB', // cp-active
  },

  // Action colors
  action: {
    activate: '#22c55e', // green-500
    deactivate: '#ef4444', // red-500
    reset: '#f59e0b', // amber-500
    destructive: '#ef4444', // red-500
  },

  // Badge colors
  badge: {
    api: '#3b82f6', // blue-500
    override: '#f59e0b', // amber-500
    manual: '#22c55e', // green-500
    info: '#6b7280', // gray-500
    experiment: '#8b5cf6', // violet-500
    personalization: '#06b6d4', // cyan-500
  },

  // Border colors (aligned with Tailwind gray scale)
  border: {
    primary: '#e5e7eb', // gray-200
    secondary: '#d1d5db', // gray-300
    focus: '#8C2EEA', // cp-normal for focus rings
  },

  // Status colors
  status: {
    qualified: '#22c55e', // green-500 for qualified indicators
    active: '#8C2EEA', // cp-normal for active states
    inactive: '#9ca3af', // gray-400
  },
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const borderRadius = {
  sm: 4,
  md: 6, // rounded-md in Tailwind
  lg: 8,
  xl: 12,
  full: 9999, // rounded-full
} as const

export const typography = {
  // Font sizes (aligned with Tailwind)
  fontSize: {
    xs: 12, // text-xs
    sm: 14, // text-sm
    md: 16, // text-base
    lg: 18, // text-lg
    xl: 20, // text-xl
    xxl: 24, // text-2xl
  },

  // Font weights (as strings for React Native)
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Line heights (aligned with Tailwind)
  lineHeight: {
    tight: 16, // leading-tight
    normal: 20, // leading-normal
    relaxed: 24, // leading-relaxed
    loose: 28, // leading-loose
  },

  // Font family reference (note: actual font loading must be done by the app)
  fontFamily: {
    // Matches the web panel's Inter var font
    primary: 'System', // 'Inter' if loaded
  },
} as const

export const shadows = {
  // Subtle shadow for cards (matches web panel's shadow-sm)
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  // Default card shadow
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  // Elevated shadow for modals/dropdowns
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
} as const

export const opacity = {
  active: 0.7,
  disabled: 0.5,
  muted: 0.6,
  full: 1,
} as const

export interface Theme {
  colors: typeof colors
  spacing: typeof spacing
  borderRadius: typeof borderRadius
  typography: typeof typography
  shadows: typeof shadows
  opacity: typeof opacity
}

export const theme: Theme = {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
  opacity,
}

export default theme

import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { borderRadius, colors, spacing, typography } from '../../styles/theme'
import type { BadgeProps } from '../../types'

/**
 * Badge variant styling configuration.
 * Colors are aligned with the web panel's design system.
 */
const variantStyles = {
  api: {
    backgroundColor: colors.badge.api,
    textColor: colors.text.inverse,
  },
  override: {
    backgroundColor: colors.badge.override,
    textColor: colors.text.inverse,
  },
  manual: {
    backgroundColor: colors.badge.manual,
    textColor: colors.text.inverse,
  },
  info: {
    backgroundColor: colors.background.tertiary,
    textColor: colors.text.secondary,
  },
  experiment: {
    backgroundColor: colors.badge.experiment,
    textColor: colors.text.inverse,
  },
  personalization: {
    backgroundColor: colors.badge.personalization,
    textColor: colors.text.inverse,
  },
  qualified: {
    backgroundColor: colors.status.qualified,
    textColor: colors.text.inverse,
  },
  primary: {
    backgroundColor: colors.cp.normal,
    textColor: colors.text.inverse,
  },
} as const

/**
 * Small badge component for status indicators and labels.
 * Styled to match the web panel's badge design.
 */
export function Badge({ label, variant }: BadgeProps): React.JSX.Element {
  const { [variant]: variantStyle } = variantStyles

  return (
    <View style={[styles.badge, { backgroundColor: variantStyle.backgroundColor }]}>
      <Text style={[styles.text, { color: variantStyle.textColor }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
})

export default Badge

import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../../styles/theme'
import type { QualificationIndicatorProps } from '../../types'

/**
 * Visual indicator showing that a user naturally qualifies for an audience or variant.
 * Displays as a green dot with optional tooltip text.
 */
export function QualificationIndicator({
  tooltipContent = 'Naturally qualifies',
  style,
}: QualificationIndicatorProps): React.JSX.Element {
  return (
    <View
      style={[styles.container, style]}
      accessibilityLabel={tooltipContent}
      accessibilityRole="text"
    >
      <View style={styles.dot} />
      <Text style={styles.label}>Qualified</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.action.activate,
    marginRight: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.xs,
    color: colors.action.activate,
    fontWeight: typography.fontWeight.medium,
  },
})

export default QualificationIndicator

import React from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { colors, spacing, typography } from '../../styles/theme'

interface CollapseToggleButtonProps {
  /** Whether all items are currently expanded */
  allExpanded: boolean
  /** Handler for toggle action */
  onToggle: () => void
}

/**
 * Button to collapse or expand all audience sections at once.
 * Styled to match the web panel's CollapsiblesToggleButton component.
 */
export function CollapseToggleButton({
  allExpanded,
  onToggle,
}: CollapseToggleButtonProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={allExpanded ? 'Collapse all sections' : 'Expand all sections'}
    >
      <Text style={styles.buttonText}>{allExpanded ? 'Collapse all' : 'Expand all'}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  buttonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.cp.normal, // Uses Contentful Personalization brand color
  },
})

export default CollapseToggleButton

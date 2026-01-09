import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { borderRadius, colors, spacing, typography } from '../../styles/theme'
import type { AudienceOverrideState, AudienceToggleProps } from '../../types'

const toggleStates: Array<{ value: AudienceOverrideState; label: string }> = [
  { value: 'on', label: 'On' },
  { value: 'default', label: 'Auto' },
  { value: 'off', label: 'Off' },
]

/**
 * Three-state toggle for audience override control.
 *
 * States:
 * - "On": Force the audience to be active
 * - "Auto" (default): Let SDK determine based on evaluation
 * - "Off": Force the audience to be inactive
 */
export function AudienceToggle({
  value,
  onValueChange,
  disabled = false,
  audienceId,
}: AudienceToggleProps): React.JSX.Element {
  return (
    <View
      style={[styles.container, disabled && styles.disabled]}
      accessibilityRole="radiogroup"
      accessibilityLabel={`Audience toggle for ${audienceId}`}
    >
      {toggleStates.map((state) => {
        const isSelected = value === state.value

        return (
          <TouchableOpacity
            key={state.value}
            style={[
              styles.button,
              isSelected && styles.buttonSelected,
              isSelected && getSelectedStyle(state.value),
            ]}
            onPress={() => {
              onValueChange(state.value)
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, disabled }}
            accessibilityLabel={`Set audience to ${state.label}`}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonText, isSelected && styles.buttonTextSelected]}>
              {state.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function getSelectedStyle(state: AudienceOverrideState): { backgroundColor: string } {
  switch (state) {
    case 'on':
      return { backgroundColor: colors.action.activate }
    case 'off':
      return { backgroundColor: colors.action.deactivate }
    case 'default':
      return { backgroundColor: colors.accent.primary }
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: 2,
  },
  disabled: {
    opacity: 0.5,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: colors.accent.primary,
  },
  buttonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  buttonTextSelected: {
    color: colors.text.inverse,
    fontWeight: typography.fontWeight.semibold,
  },
})

export default AudienceToggle

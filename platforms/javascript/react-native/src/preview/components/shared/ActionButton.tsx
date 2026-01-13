import React from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { borderRadius, colors, spacing, typography } from '../../styles/theme'
import type { ActionButtonProps } from '../../types'

/**
 * Button variant styling configuration.
 * Primary and secondary variants use Contentful Personalization brand colors.
 */
const variantStyles = {
  activate: {
    backgroundColor: colors.action.activate,
    textColor: colors.text.inverse,
  },
  deactivate: {
    backgroundColor: colors.action.deactivate,
    textColor: colors.text.inverse,
  },
  reset: {
    backgroundColor: colors.action.reset,
    textColor: colors.text.inverse,
  },
  primary: {
    backgroundColor: colors.cp.normal, // Contentful Personalization purple
    textColor: colors.text.inverse,
  },
  secondary: {
    backgroundColor: colors.background.primary,
    textColor: colors.text.primary,
    borderColor: colors.border.secondary,
  },
  destructive: {
    backgroundColor: colors.action.destructive,
    textColor: colors.text.inverse,
  },
} as const

export function ActionButton({
  label,
  variant,
  onPress,
  disabled = false,
  style,
}: ActionButtonProps): React.JSX.Element {
  const { [variant]: variantStyle } = variantStyles
  const isSecondary = variant === 'secondary'

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: variantStyle.backgroundColor },
        isSecondary && styles.secondaryButton,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.buttonText, { color: variantStyle.textColor }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border.secondary,
  },
  buttonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  disabled: {
    opacity: 0.5,
  },
})

export default ActionButton

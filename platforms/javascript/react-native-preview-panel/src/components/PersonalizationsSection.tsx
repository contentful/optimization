import Clipboard from '@react-native-clipboard/clipboard'
import React from 'react'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { commonStyles } from '../styles/common'
import { borderRadius, colors, spacing, typography } from '../styles/theme'
import type { PersonalizationsSectionProps } from '../types'
import { ActionButton, Section } from './shared'

function copyToClipboard(text: string, label: string): void {
  Clipboard.setString(text)
  Alert.alert('Copied', `${label} copied to clipboard`)
}

export function PersonalizationsSection({
  personalizations,
  overrides,
  onSetVariant,
  onResetOverride,
  experienceNames = {},
}: PersonalizationsSectionProps): React.JSX.Element {
  if (!personalizations || personalizations.length === 0) {
    return (
      <Section title="Personalizations">
        <Text style={commonStyles.emptyText}>No active personalizations</Text>
      </Section>
    )
  }

  const handleSetVariant = (experienceId: string, variantIndex: number): void => {
    Alert.alert(
      'Set Variant',
      `Set experience to ${variantIndex === 0 ? 'Baseline' : `Variant ${variantIndex}`}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set',
          onPress: () => {
            onSetVariant(experienceId, variantIndex)
          },
        },
      ],
    )
  }

  const handleResetOverride = (experienceId: string): void => {
    Alert.alert('Reset Override', 'Remove manual override for this experience?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: () => {
          onResetOverride(experienceId)
        },
      },
    ])
  }

  return (
    <Section title="Personalizations">
      {personalizations.map((personalization) => {
        const { experienceId, variantIndex, variants } = personalization
        const variantCount = Object.keys(variants).length + 1
        const { [experienceId]: override } = overrides
        const currentVariant = override?.variantIndex ?? variantIndex
        const displayName = experienceNames[experienceId] ?? experienceId

        return (
          <View key={experienceId} style={styles.experienceItem}>
            {/* Experience Header */}
            <TouchableOpacity
              onLongPress={() => {
                copyToClipboard(experienceId, 'Experience ID')
              }}
            >
              <Text style={styles.experienceTitle}>{displayName}</Text>
              <Text style={styles.experienceSubtitle}>
                Current: {currentVariant === 0 ? 'Baseline' : `Variant ${currentVariant}`}
                {override && ' (Override)'}
              </Text>
            </TouchableOpacity>

            {/* Variant Controls */}
            <View style={styles.variantControls}>
              {Array.from({ length: variantCount }, (_, index) => {
                const isActive = currentVariant === index
                const variantLabel = index === 0 ? 'Baseline' : `V${index}`

                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.variantButton, isActive && styles.variantButtonActive]}
                    onPress={() => {
                      handleSetVariant(experienceId, index)
                    }}
                  >
                    <Text
                      style={[styles.variantButtonText, isActive && styles.variantButtonTextActive]}
                    >
                      {variantLabel}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Variants Mapping */}
            <View style={styles.variantsInfo}>
              <Text style={commonStyles.secondaryText}>
                Variants: {Object.keys(variants).length}
              </Text>
            </View>

            {/* Reset Button */}
            {override && (
              <ActionButton
                label="Reset Override"
                variant="reset"
                onPress={() => {
                  handleResetOverride(experienceId)
                }}
                style={styles.resetButton}
              />
            )}
          </View>
        )
      })}
    </Section>
  )
}

const styles = StyleSheet.create({
  experienceItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.secondary,
    paddingBottom: spacing.lg,
    marginBottom: spacing.lg,
  },
  experienceTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  experienceSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  variantControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  variantButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  variantButtonActive: {
    backgroundColor: colors.accent.primary,
  },
  variantButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  variantButtonTextActive: {
    color: colors.text.inverse,
  },
  variantsInfo: {
    marginBottom: spacing.sm,
  },
  resetButton: {
    alignSelf: 'flex-start',
  },
})

export default PersonalizationsSection

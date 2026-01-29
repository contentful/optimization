import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { borderRadius, colors, spacing, typography } from '../styles/theme'
import type { VariantDistribution, VariantSelectorProps } from '../types'
import { QualificationIndicator } from './shared'

type StyleArray = Array<StyleProp<ViewStyle>>

interface VariantButtonProps {
  variant: VariantDistribution
  isSelected: boolean
  isQualified: boolean
  isExperiment: boolean
  isAudienceActive: boolean
  onSelect: () => void
}

/** Get card styles based on state */
function getCardStyles(isSelected: boolean, isAudienceActive: boolean): StyleArray {
  return [
    styles.variantCard,
    isSelected && styles.variantCardSelected,
    !isAudienceActive && styles.variantCardInactive,
  ]
}

/** Get the display label for a variant */
function getVariantLabel(variant: VariantDistribution): string {
  if (variant.name) {
    return variant.name
  }
  return variant.index === 0 ? 'Baseline' : `Variant ${variant.index}`
}

/** Radio button component */
function RadioButton({ isSelected }: { isSelected: boolean }): React.JSX.Element {
  return (
    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
      {isSelected && <View style={styles.radioInner} />}
    </View>
  )
}

/** Single variant card within the selector */
function VariantButton({
  variant,
  isSelected,
  isQualified,
  isExperiment,
  isAudienceActive,
  onSelect,
}: VariantButtonProps): React.JSX.Element {
  const variantLabel = getVariantLabel(variant)
  const percentageLabel = variant.percentage != null ? `${variant.percentage}%` : null

  return (
    <TouchableOpacity
      style={getCardStyles(isSelected, isAudienceActive)}
      onPress={onSelect}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${variantLabel}${percentageLabel ? `, ${percentageLabel}` : ''}`}
    >
      <View style={styles.variantContent}>
        <View style={styles.labelContainer}>
          <View style={styles.variantLabelRow}>
            <Text style={[styles.variantLabel, !isAudienceActive && styles.variantLabelInactive]}>
              {variantLabel}
            </Text>
            {isQualified && <QualificationIndicator style={styles.qualificationIndicator} />}
          </View>
          {isExperiment && percentageLabel != null && (
            <Text
              style={[styles.percentageLabel, !isAudienceActive && styles.percentageLabelInactive]}
            >
              {percentageLabel}
            </Text>
          )}
        </View>
        <RadioButton isSelected={isSelected} />
      </View>
    </TouchableOpacity>
  )
}

/**
 * Selector component for choosing experience variants.
 *
 * - For personalizations: horizontal button group
 * - For experiments: vertical list with distribution percentages
 */
export function VariantSelector({
  experience,
  selectedIndex,
  onSelect,
  isAudienceActive,
  qualifiedIndex,
}: VariantSelectorProps): React.JSX.Element {
  const isExperiment = experience.type === 'nt_experiment'

  return (
    <View style={styles.container}>
      {experience.distribution.map((variant) => (
        <VariantButton
          key={variant.index}
          variant={variant}
          isSelected={selectedIndex === variant.index}
          isQualified={qualifiedIndex === variant.index}
          isExperiment={isExperiment}
          isAudienceActive={isAudienceActive}
          onSelect={() => {
            onSelect(variant.index)
          }}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  variantCard: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  variantCardSelected: {
    borderColor: colors.cp.normal,
  },
  variantCardInactive: {
    opacity: 0.6,
  },
  variantContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelContainer: {
    flex: 1,
  },
  variantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  variantLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  variantLabelInactive: {
    color: colors.text.muted,
  },
  qualificationIndicator: {
    marginLeft: spacing.sm,
  },
  percentageLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  percentageLabelInactive: {
    color: colors.text.muted,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  radioOuterSelected: {
    borderColor: colors.cp.normal,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.cp.normal,
  },
})

export default VariantSelector

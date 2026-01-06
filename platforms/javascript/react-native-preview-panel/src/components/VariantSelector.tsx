import React from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { borderRadius, colors, spacing, typography } from '../styles/theme'
import type { VariantDistribution, VariantSelectorProps } from '../types'
import { QualificationIndicator } from './shared'

type StyleArray = Array<StyleProp<ViewStyle | TextStyle>>

interface VariantButtonProps {
  variant: VariantDistribution
  isSelected: boolean
  isQualified: boolean
  isExperiment: boolean
  isAudienceActive: boolean
  onSelect: () => void
}

/** Get button styles based on state */
const getButtonStyles = (
  isSelected: boolean,
  isExperiment: boolean,
  isAudienceActive: boolean,
): StyleArray => [
  styles.variantButton,
  isExperiment && styles.variantButtonVertical,
  isSelected && styles.variantButtonSelected,
  !isAudienceActive && styles.variantButtonInactive,
]

/** Get label styles based on state */
const getLabelStyles = (isSelected: boolean, isAudienceActive: boolean): StyleArray => [
  styles.variantLabel,
  isSelected && styles.variantLabelSelected,
  !isAudienceActive && styles.variantLabelInactive,
]

/** Get percentage label styles based on state */
const getPercentageStyles = (isSelected: boolean, isAudienceActive: boolean): StyleArray => [
  styles.percentageLabel,
  isSelected && styles.percentageLabelSelected,
  !isAudienceActive && styles.percentageLabelInactive,
]

/** Single variant button within the selector */
const VariantButton = ({
  variant,
  isSelected,
  isQualified,
  isExperiment,
  isAudienceActive,
  onSelect,
}: VariantButtonProps): React.JSX.Element => {
  const variantLabel = variant.index === 0 ? 'Baseline' : `Variant ${variant.index}`
  const percentageLabel = variant.percentage != null ? `${variant.percentage}%` : null

  return (
    <TouchableOpacity
      style={getButtonStyles(isSelected, isExperiment, isAudienceActive)}
      onPress={onSelect}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${variantLabel}${percentageLabel ? `, ${percentageLabel}` : ''}`}
    >
      <View style={styles.variantContent}>
        <View style={styles.variantLabelRow}>
          <Text style={getLabelStyles(isSelected, isAudienceActive)}>{variantLabel}</Text>
          {isQualified && <QualificationIndicator style={styles.qualificationIndicator} />}
        </View>
        {isExperiment && percentageLabel != null && (
          <Text style={getPercentageStyles(isSelected, isAudienceActive)}>{percentageLabel}</Text>
        )}
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
export const VariantSelector = ({
  experience,
  selectedIndex,
  onSelect,
  isAudienceActive,
  qualifiedIndex,
}: VariantSelectorProps): React.JSX.Element => {
  const isExperiment = experience.type === 'nt_experiment'

  return (
    <View style={[styles.container, isExperiment && styles.containerVertical]}>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  containerVertical: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  variantButton: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.secondary,
    minWidth: 80,
  },
  variantButtonVertical: {
    borderRadius: borderRadius.md,
    minWidth: undefined,
  },
  variantButtonSelected: {
    backgroundColor: colors.cp.normal, // Uses Contentful Personalization brand color
    borderColor: colors.cp.normal,
  },
  variantButtonInactive: {
    opacity: 0.6,
  },
  variantContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  variantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  variantLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  variantLabelSelected: {
    color: colors.text.inverse,
    fontWeight: typography.fontWeight.semibold,
  },
  variantLabelInactive: {
    color: colors.text.muted,
  },
  qualificationIndicator: {
    marginLeft: spacing.sm,
  },
  percentageLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.md,
  },
  percentageLabelSelected: {
    color: colors.text.inverse,
  },
  percentageLabelInactive: {
    color: colors.text.muted,
  },
})

export default VariantSelector

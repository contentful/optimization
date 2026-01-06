import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { borderRadius, colors, shadows, spacing, typography } from '../styles/theme'
import type { BadgeProps, ExperienceCardProps } from '../types'
import { ActionButton, Badge } from './shared'
import { VariantSelector } from './VariantSelector'

/**
 * Card component displaying an experience with its variants.
 * Styled to match the web panel's ExperienceCard component.
 *
 * Shows:
 * - Type badge (Experiment vs Personalization)
 * - Experience name
 * - Variant selector with qualification indicators
 * - Override indicator and reset button
 */
export const ExperienceCard = ({
  experience,
  isAudienceActive,
  currentVariantIndex,
  defaultVariantIndex,
  onSetVariant,
  onReset,
  hasOverride,
}: ExperienceCardProps): React.JSX.Element => {
  const isExperiment = experience.type === 'nt_experiment'
  const typeLabel = isExperiment ? 'Experiment' : 'Personalization'
  const typeBadgeVariant: BadgeProps['variant'] = isExperiment ? 'experiment' : 'personalization'

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <Badge label={typeLabel} variant={typeBadgeVariant} />
          {hasOverride && <Badge label="Override" variant="override" />}
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {experience.name}
        </Text>
      </View>

      {/* Variant Selector */}
      <View style={styles.variantSection}>
        <VariantSelector
          experience={experience}
          selectedIndex={currentVariantIndex}
          onSelect={onSetVariant}
          isAudienceActive={isAudienceActive}
          qualifiedIndex={defaultVariantIndex}
        />
      </View>

      {/* Reset button when overridden */}
      {hasOverride && onReset && (
        <View style={styles.resetSection}>
          <ActionButton label="Reset to Default" variant="reset" onPress={onReset} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.primary,
    padding: spacing.md,
    ...shadows.sm,
  },
  header: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  name: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    lineHeight: typography.lineHeight.normal,
  },
  variantSection: {
    marginBottom: spacing.xs,
  },
  resetSection: {
    marginTop: spacing.md,
    alignItems: 'flex-start',
  },
})

export default ExperienceCard

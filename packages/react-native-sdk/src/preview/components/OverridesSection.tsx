import React from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { commonStyles } from '../styles/common'
import { spacing } from '../styles/theme'
import type { OverridesSectionProps } from '../types'
import { ListItem, Section } from './shared'

/**
 * Displays all active audience and optimization overrides with reset controls.
 *
 * @param props - Component props
 * @returns The rendered overrides section
 *
 * @public
 */
export function OverridesSection({
  overrides,
  onResetAudience,
  onResetOptimization,
  audienceNames = {},
  experienceNames = {},
}: OverridesSectionProps): React.JSX.Element {
  const audienceOverrides = Object.values(overrides.audiences)
  const optimizationOverrides = Object.values(overrides.selectedOptimizations)
  const totalOverrides = audienceOverrides.length + optimizationOverrides.length

  const getAudienceName = (audienceId: string): string => audienceNames[audienceId] ?? audienceId
  const getExperienceName = (experienceId: string): string =>
    experienceNames[experienceId] ?? experienceId

  const handleResetAudience = (audienceId: string): void => {
    const name = getAudienceName(audienceId)
    Alert.alert('Reset Override', `Remove override for audience "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: () => {
          onResetAudience(audienceId)
        },
      },
    ])
  }

  const handleResetOptimization = (experienceId: string): void => {
    const name = getExperienceName(experienceId)
    Alert.alert('Reset Override', `Remove override for experience "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: () => {
          onResetOptimization(experienceId)
        },
      },
    ])
  }

  if (totalOverrides === 0) {
    return (
      <Section title="Overrides">
        <Text style={commonStyles.emptyText}>No active overrides</Text>
      </Section>
    )
  }

  return (
    <Section title="Overrides">
      {/* Summary */}
      <View style={styles.summary}>
        <Text style={commonStyles.secondaryText}>
          {audienceOverrides.length} audience override(s), {optimizationOverrides.length}{' '}
          optimization override(s)
        </Text>
      </View>

      {/* Audience Overrides */}
      {audienceOverrides.length > 0 && (
        <View style={styles.subsection}>
          <Text style={commonStyles.subsectionTitle}>Audience Overrides</Text>
          {audienceOverrides.map((override) => (
            <ListItem
              key={override.audienceId}
              label={getAudienceName(override.audienceId)}
              value={override.isActive ? 'Activated' : 'Deactivated'}
              action={{
                label: 'Reset',
                variant: 'reset',
                onPress: () => {
                  handleResetAudience(override.audienceId)
                },
                testID: `reset-audience-${override.audienceId}`,
              }}
            />
          ))}
        </View>
      )}

      {/* Optimization Overrides */}
      {optimizationOverrides.length > 0 && (
        <View style={styles.subsection}>
          <Text style={commonStyles.subsectionTitle}>Optimization Overrides</Text>
          {optimizationOverrides.map((override) => (
            <ListItem
              key={override.experienceId}
              label={getExperienceName(override.experienceId)}
              value={override.variantIndex === 0 ? 'Baseline' : `Variant ${override.variantIndex}`}
              action={{
                label: 'Reset',
                variant: 'reset',
                onPress: () => {
                  handleResetOptimization(override.experienceId)
                },
                testID: `reset-variant-${override.experienceId}`,
              }}
            />
          ))}
        </View>
      )}
    </Section>
  )
}

const styles = StyleSheet.create({
  summary: {
    marginBottom: spacing.md,
  },
  subsection: {
    marginBottom: spacing.lg,
  },
})

export default OverridesSection

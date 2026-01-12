import React from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { commonStyles } from '../styles/common'
import { spacing } from '../styles/theme'
import type { OverridesSectionProps } from '../types'
import { ListItem, Section } from './shared'

export function OverridesSection({
  overrides,
  onResetAudience,
  onResetPersonalization,
}: OverridesSectionProps): React.JSX.Element {
  const audienceOverrides = Object.values(overrides.audiences)
  const personalizationOverrides = Object.values(overrides.personalizations)
  const totalOverrides = audienceOverrides.length + personalizationOverrides.length

  const handleResetAudience = (audienceId: string): void => {
    Alert.alert('Reset Override', `Remove override for audience "${audienceId}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: () => {
          onResetAudience(audienceId)
        },
      },
    ])
  }

  const handleResetPersonalization = (experienceId: string): void => {
    Alert.alert('Reset Override', `Remove override for experience "${experienceId}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: () => {
          onResetPersonalization(experienceId)
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
          {audienceOverrides.length} audience override(s), {personalizationOverrides.length}{' '}
          personalization override(s)
        </Text>
      </View>

      {/* Audience Overrides */}
      {audienceOverrides.length > 0 && (
        <View style={styles.subsection}>
          <Text style={commonStyles.subsectionTitle}>Audience Overrides</Text>
          {audienceOverrides.map((override) => (
            <ListItem
              key={override.audienceId}
              label={override.audienceId}
              value={override.isActive ? 'Activated' : 'Deactivated'}
              badge={{ label: 'Override', variant: 'override' }}
              action={{
                label: 'Reset',
                variant: 'reset',
                onPress: () => {
                  handleResetAudience(override.audienceId)
                },
              }}
            />
          ))}
        </View>
      )}

      {/* Personalization Overrides */}
      {personalizationOverrides.length > 0 && (
        <View style={styles.subsection}>
          <Text style={commonStyles.subsectionTitle}>Personalization Overrides</Text>
          {personalizationOverrides.map((override) => (
            <ListItem
              key={override.experienceId}
              label={override.experienceId}
              value={override.variantIndex === 0 ? 'Baseline' : `Variant ${override.variantIndex}`}
              badge={{ label: 'Override', variant: 'override' }}
              action={{
                label: 'Reset',
                variant: 'reset',
                onPress: () => {
                  handleResetPersonalization(override.experienceId)
                },
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

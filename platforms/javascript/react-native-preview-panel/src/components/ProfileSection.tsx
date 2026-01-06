import Clipboard from '@react-native-clipboard/clipboard'
import React from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { commonStyles } from '../styles/common'
import { spacing } from '../styles/theme'
import type { ProfileSectionProps } from '../types'
import { JsonViewer, ListItem, Section } from './shared'

function copyToClipboard(text: string, label: string): void {
  Clipboard.setString(text)
  Alert.alert('Copied', `${label} copied to clipboard`)
}

export function ProfileSection({ profile, isLoading }: ProfileSectionProps): React.JSX.Element {
  if (isLoading) {
    return (
      <Section title="Profile">
        <Text style={commonStyles.mutedText}>Loading profile...</Text>
      </Section>
    )
  }

  if (!profile) {
    return (
      <Section title="Profile">
        <Text style={commonStyles.emptyText}>No profile data available</Text>
      </Section>
    )
  }

  const { traits, audiences } = profile
  const traitEntries = Object.entries(traits)

  return (
    <Section title="Profile">
      {/* Profile ID */}
      <View style={styles.subsection}>
        <Text style={commonStyles.subsectionTitle}>Profile ID</Text>
        <ListItem
          label={profile.id}
          onLongPress={() => {
            copyToClipboard(profile.id, 'Profile ID')
          }}
        />
      </View>

      {/* Traits */}
      <View style={styles.subsection}>
        <Text style={commonStyles.subsectionTitle}>Traits ({traitEntries.length})</Text>
        {traitEntries.length > 0 ? (
          traitEntries.map(([key, value]) => (
            <ListItem
              key={key}
              label={key}
              value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
            />
          ))
        ) : (
          <Text style={commonStyles.emptyText}>No traits available</Text>
        )}
      </View>

      {/* Audiences */}
      <View style={styles.subsection}>
        <Text style={commonStyles.subsectionTitle}>Audiences ({audiences.length})</Text>
        {audiences.length > 0 ? (
          audiences.map((audienceId) => (
            <ListItem
              key={audienceId}
              label={audienceId}
              badge={{ label: 'API', variant: 'api' }}
              onLongPress={() => {
                copyToClipboard(audienceId, 'Audience ID')
              }}
            />
          ))
        ) : (
          <Text style={commonStyles.emptyText}>No audiences assigned</Text>
        )}
      </View>

      {/* Full Profile JSON */}
      <JsonViewer data={profile} title="Complete Profile (JSON)" />
    </Section>
  )
}

const styles = StyleSheet.create({
  subsection: {
    marginBottom: spacing.lg,
  },
})

export default ProfileSection

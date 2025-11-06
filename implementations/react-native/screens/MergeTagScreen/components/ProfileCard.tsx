/**
 * ProfileCard - Displays current user profile information
 */

import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { Profile } from '@contentful/optimization-react-native'

import type { ThemeColors } from '../types'

interface ProfileCardProps {
  profile: Profile | undefined
  colors: ThemeColors
}

interface DetailRowProps {
  label: string
  value: string
  colors: ThemeColors
  ellipsizeMode?: 'middle' | 'head' | 'tail' | 'clip'
}

function DetailRow({ label, value, colors, ellipsizeMode }: DetailRowProps): React.JSX.Element {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.mutedTextColor }]}>{label}:</Text>
      <Text
        style={[styles.detailValue, { color: colors.textColor }]}
        numberOfLines={ellipsizeMode ? 1 : undefined}
        ellipsizeMode={ellipsizeMode}
      >
        {value}
      </Text>
    </View>
  )
}

export function ProfileCard({ profile, colors }: ProfileCardProps): React.JSX.Element | null {
  if (!profile) return null

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
      <Text style={[styles.title, { color: colors.textColor }]}>Current Profile Data</Text>
      <View style={styles.detailSection}>
        <DetailRow label="Profile ID" value={profile.id} colors={colors} ellipsizeMode="middle" />
        <DetailRow label="Continent" value={profile.location.continent} colors={colors} />
        <DetailRow label="City" value={profile.location.city} colors={colors} />
        <DetailRow label="Country" value={profile.location.countryCode} colors={colors} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailSection: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    width: 120,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    fontFamily: 'monospace',
  },
})

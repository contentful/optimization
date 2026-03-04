import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { SDKConfigCardProps } from '../types'

export function SDKConfigCard({ sdkInfo, colors }: SDKConfigCardProps): React.JSX.Element {
  const { cardBackground, textColor, mutedTextColor } = colors

  return (
    <View style={[styles.card, { backgroundColor: cardBackground }]} testID="sdkConfigCard">
      <Text style={[styles.cardTitle, { color: textColor }]}>Configuration</Text>

      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: mutedTextColor }]}>Client ID:</Text>
        <Text style={[styles.infoValue, { color: textColor }]} testID="clientIdValue">
          {sdkInfo.clientId}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: mutedTextColor }]}>Environment:</Text>
        <Text style={[styles.infoValue, { color: textColor }]} testID="environmentValue">
          {sdkInfo.environment}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: mutedTextColor }]}>Initialized At:</Text>
        <Text style={[styles.infoValue, { color: textColor }]} testID="timestampValue">
          {new Date(sdkInfo.timestamp).toLocaleTimeString()}
        </Text>
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
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'monospace',
  },
})

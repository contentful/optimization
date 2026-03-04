import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import type { SDKStatusCardProps } from '../types'

export function SDKStatusCard({
  sdkLoaded,
  sdkError,
  colors,
}: SDKStatusCardProps): React.JSX.Element {
  const { cardBackground, textColor, mutedTextColor, successColor, errorColor } = colors

  return (
    <View style={[styles.card, { backgroundColor: cardBackground }]} testID="sdkStatusCard">
      <Text style={[styles.cardTitle, { color: textColor }]}>SDK Status</Text>

      {!sdkLoaded && !sdkError && (
        <View style={styles.statusRow} testID="sdkInitializing">
          <ActivityIndicator size="small" color={successColor} />
          <Text style={[styles.statusText, { color: mutedTextColor }]}>Initializing SDK...</Text>
        </View>
      )}

      {sdkLoaded && (
        <View style={styles.statusRow} testID="sdkLoaded">
          <View style={[styles.statusIndicator, { backgroundColor: successColor }]} />
          <Text style={[styles.statusText, { color: successColor }]} testID="sdkLoadedText">
            ✓ SDK Loaded Successfully
          </Text>
        </View>
      )}

      {sdkError && (
        <View style={styles.statusRow} testID="sdkError">
          <View style={[styles.statusIndicator, { backgroundColor: errorColor }]} />
          <Text style={[styles.statusText, { color: errorColor }]} testID="sdkErrorText">
            ✗ Error: {sdkError}
          </Text>
        </View>
      )}
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
  },
})

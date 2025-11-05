import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { InstructionsCardProps } from '../types'

export function InstructionsCard({
  colors,
  onTestTracking,
  onTestMergeTags,
}: InstructionsCardProps): React.JSX.Element {
  const { cardBackground, textColor, mutedTextColor } = colors

  return (
    <View style={[styles.card, { backgroundColor: cardBackground }]} testID="instructionsCard">
      <Text style={[styles.cardTitle, { color: textColor }]}>Next Steps</Text>
      <Text style={[styles.instructionText, { color: mutedTextColor }]} testID="instructionsText">
        • The Optimization SDK is now initialized and ready to use{'\n'}• You can now implement
        experiences and personalization{'\n'}• Check the console for additional SDK logs{'\n'}•
        Modify this app to test SDK features
      </Text>

      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: colors.successColor }]}
        onPress={onTestTracking}
        testID="testTrackingButton"
      >
        <Text style={styles.testButtonText}>Test Viewport Tracking →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: colors.accentColor, marginTop: 12 }]}
        onPress={onTestMergeTags}
        testID="testMergeTagsButton"
      >
        <Text style={styles.testButtonText}>Test Merge Tags →</Text>
      </TouchableOpacity>
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
  instructionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  testButton: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})

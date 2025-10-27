/**
 * Test Tracking Screen - Demonstrates viewport tracking functionality
 */

import React, { useEffect, useState } from 'react'
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import { OptimizationTrackedView, ScrollProvider } from '@contentful/optimization-react-native'

interface ThemeColors {
  backgroundColor: string
  cardBackground: string
  textColor: string
  mutedTextColor: string
  successColor: string
  errorColor: string
}

interface TestTrackingScreenProps {
  colors: ThemeColors
  onBack: () => void
  sdk: Optimization
}

export function TestTrackingScreen({
  colors,
  onBack,
  sdk,
}: TestTrackingScreenProps): React.JSX.Element {
  const [trackedEvents, setTrackedEvents] = useState<string[]>([])

  useEffect(() => {
    // Listen to the event stream to capture tracking events
    const subscription = sdk.states.eventStream.subscribe((event) => {
      if (event?.type === 'component') {
        const { componentId } = event as { componentId?: string }
        const timestamp = new Date().toLocaleTimeString()
        setTrackedEvents((prev) => [...prev, `${timestamp}: Tracked "${componentId}"`])
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
      <StatusBar barStyle={useColorScheme() === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header with back button */}
      <View style={[styles.testHeader, { borderBottomColor: colors.mutedTextColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} testID="backButton">
          <Text style={[styles.backButtonText, { color: colors.successColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.testTitle, { color: colors.textColor }]}>Viewport Tracking Test</Text>
      </View>

      <ScrollProvider>
        {/* Filler content to push tracked view below viewport */}
        <View style={[styles.fillerSection, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>
            Scroll Down to Test Tracking
          </Text>
          <Text style={[styles.sectionText, { color: colors.mutedTextColor }]}>
            The tracked component is below the viewport. Scroll down to bring it fully into view and
            trigger the tracking event.
          </Text>
        </View>

        <View
          style={[styles.fillerSection, { backgroundColor: colors.cardBackground }]}
          testID="fillerView1"
        >
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Non-Tracked View 1</Text>
          <Text style={[styles.sectionText, { color: colors.mutedTextColor }]}>
            This is a regular view that doesn't track viewport visibility.
          </Text>
        </View>

        <View
          style={[styles.fillerSection, { backgroundColor: colors.cardBackground }]}
          testID="fillerView2"
        >
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Non-Tracked View 2</Text>
          <Text style={[styles.sectionText, { color: colors.mutedTextColor }]}>
            Another regular view to create scrollable content.
          </Text>
        </View>

        <View
          style={[styles.fillerSection, { backgroundColor: colors.cardBackground }]}
          testID="fillerView3"
        >
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Non-Tracked View 3</Text>
          <Text style={[styles.sectionText, { color: colors.mutedTextColor }]}>
            Keep scrolling down to reach the tracked component...
          </Text>
        </View>

        {/* Tracked component */}
        <OptimizationTrackedView
          componentId="test-hero-banner"
          experienceId="exp-test-123"
          variantIndex={0}
          style={StyleSheet.flatten([styles.trackedView, { backgroundColor: colors.successColor }])}
        >
          <Text style={styles.trackedViewTitle}>Tracked Component</Text>
          <Text style={styles.trackedViewText}>
            Testing out viewport tracking here with a tracked component.
          </Text>
          <Text style={styles.trackedViewDetails}>
            Component ID: test-hero-banner{'\n'}
            Experience ID: exp-test-123{'\n'}
            Variant Index: 0
          </Text>
        </OptimizationTrackedView>

        {/* Event log */}
        <View style={[styles.eventLog, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Event Log</Text>
          {trackedEvents.length === 0 ? (
            <Text style={[styles.sectionText, { color: colors.mutedTextColor }]}>
              No events tracked yet. Scroll up to bring the tracked component into view.
            </Text>
          ) : (
            trackedEvents.map((event, index) => (
              <Text
                key={index}
                style={[styles.eventText, { color: colors.successColor }]}
                testID={`trackedEvent${index}`}
              >
                ✓ {event}
              </Text>
            ))
          )}
        </View>

        {/* Bottom spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollProvider>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  testTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 16,
  },
  fillerSection: {
    padding: 24,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    minHeight: 200,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  trackedView: {
    padding: 24,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    minHeight: 200,
  },
  trackedViewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  trackedViewText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
    lineHeight: 24,
  },
  trackedViewDetails: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  eventLog: {
    padding: 24,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    minHeight: 150,
  },
  eventText: {
    fontSize: 14,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  bottomSpacer: {
    height: 100,
  },
})

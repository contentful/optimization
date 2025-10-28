/**
 * Test Tracking Screen - Demonstrates viewport tracking functionality
 *
 * This screen demonstrates both the new Personalization and Analytics components
 * with mock Contentful entry data.
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
import { Analytics, Personalization, ScrollProvider } from '@contentful/optimization-react-native'

/**
 * Mock Entry types for demonstration
 */
interface MockEntrySys {
  id: string
  type: string
  contentType: {
    sys: {
      type: string
      linkType: string
      id: string
    }
  }
  createdAt: string
  updatedAt: string
  revision: number
  space: { sys: { type: string; linkType: string; id: string } }
  environment: { sys: { type: string; linkType: string; id: string } }
}

interface MockHeroEntry {
  sys: MockEntrySys
  fields: {
    title: string
    subtitle: string
  }
  metadata: { tags: unknown[] }
}

interface MockProductEntry {
  sys: MockEntrySys
  fields: {
    name: string
    price: number
    description: string
  }
  metadata: { tags: unknown[] }
}

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

/**
 * Mock Contentful entry data for demonstration
 */
const mockPersonalizedEntry: MockHeroEntry = {
  sys: {
    id: 'personalized-hero-baseline',
    type: 'Entry',
    contentType: {
      sys: {
        type: 'Link',
        linkType: 'ContentType',
        id: 'hero',
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revision: 1,
    space: { sys: { type: 'Link', linkType: 'Space', id: 'test-space' } },
    environment: { sys: { type: 'Link', linkType: 'Environment', id: 'master' } },
  },
  fields: {
    title: 'Welcome to Contentful Optimization!',
    subtitle: 'This hero can be personalized',
  },
  metadata: { tags: [] },
}

const mockProductEntry: MockProductEntry = {
  sys: {
    id: 'product-card-123',
    type: 'Entry',
    contentType: {
      sys: {
        type: 'Link',
        linkType: 'ContentType',
        id: 'product',
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revision: 1,
    space: { sys: { type: 'Link', linkType: 'Space', id: 'test-space' } },
    environment: { sys: { type: 'Link', linkType: 'Environment', id: 'master' } },
  },
  fields: {
    name: 'Premium Widget',
    price: 99.99,
    description: 'A non-personalized product entry',
  },
  metadata: { tags: [] },
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
        <Text style={[styles.testTitle, { color: colors.textColor }]}>Component Tracking Test</Text>
      </View>

      <ScrollProvider>
        {/* Info section */}
        <View style={[styles.fillerSection, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>
            Component Tracking Demo
          </Text>
          <Text style={[styles.sectionText, { color: colors.mutedTextColor }]}>
            Scroll down to see the new {'<Personalization />'} and {'<Analytics />'} components in
            action. Each tracks when 80% visible for 2 seconds.
          </Text>
          <Text style={[styles.sectionText, { color: colors.mutedTextColor, marginTop: 12 }]}>
            📝 Note: "Component tracking" refers to tracking Contentful entry components (CMS
            content), not React Native UI components.
          </Text>
        </View>

        <View
          style={[styles.fillerSection, { backgroundColor: colors.cardBackground }]}
          testID="fillerView1"
        >
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Spacer Content</Text>
          <Text style={[styles.sectionText, { color: colors.mutedTextColor }]}>
            This creates scrollable content. Keep scrolling to reach the tracked components below...
          </Text>
        </View>

        {/* Personalization component example */}
        <Personalization
          baselineEntry={mockPersonalizedEntry}
          viewTimeMs={2000} // 2 seconds
          threshold={0.8} // 80% visible
          style={StyleSheet.flatten([styles.trackedView, { backgroundColor: '#6366f1' }])}
        >
          {() => (
            <View>
              <Text style={styles.componentLabel}>{'<Personalization />'}</Text>
              <Text style={styles.trackedViewTitle}>{mockPersonalizedEntry.fields.title}</Text>
              <Text style={styles.trackedViewText}>{mockPersonalizedEntry.fields.subtitle}</Text>
              <Text style={styles.trackedViewDetails}>
                Entry ID: {mockPersonalizedEntry.sys.id}
                {'\n'}
                Type: Personalized Hero
                {'\n'}
                Tracking: 80% visible for 2000ms
              </Text>
            </View>
          )}
        </Personalization>

        <View
          style={[styles.fillerSection, { backgroundColor: colors.cardBackground }]}
          testID="fillerView2"
        >
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>More Content</Text>
          <Text style={[styles.sectionText, { color: colors.mutedTextColor }]}>
            Keep scrolling to see the Analytics component next...
          </Text>
        </View>

        <Analytics
          entry={mockProductEntry}
          viewTimeMs={1500}
          threshold={0.9}
          style={StyleSheet.flatten([styles.trackedView, { backgroundColor: '#10b981' }])}
        >
          <View>
            <Text style={styles.componentLabel}>{'<Analytics />'}</Text>
            <Text style={styles.trackedViewTitle}>{mockProductEntry.fields.name}</Text>
            <Text style={styles.trackedViewText}>${mockProductEntry.fields.price}</Text>
            <Text style={styles.trackedViewText}>{mockProductEntry.fields.description}</Text>
            <Text style={styles.trackedViewDetails}>
              Entry ID: {mockProductEntry.sys.id}
              {'\n'}
              Type: Non-personalized Product
              {'\n'}
              Tracking: 90% visible for 1500ms (custom)
            </Text>
          </View>
        </Analytics>

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
  componentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    letterSpacing: 0.5,
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

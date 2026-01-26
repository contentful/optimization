/**
 * Personalization Demo Screen - Demonstrates PreviewPanel capabilities
 *
 * This screen displays personalized content cards that update in real-time
 * when variant selections are changed in the PreviewPanel.
 */

import React from 'react'
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native'

import { Personalization, ScrollProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'
import type { DemoEntries } from './utils/sdkHelpers'

interface ThemeColors {
  backgroundColor: string
  cardBackground: string
  textColor: string
  mutedTextColor: string
  successColor: string
  errorColor: string
}

interface PersonalizationDemoScreenProps {
  colors: ThemeColors
  onBack: () => void
  demoEntries: DemoEntries
}

interface ContentCardProps {
  entry: Entry
  label: string
  color: string
}

function getFieldText(field: unknown): string {
  if (typeof field === 'string') {
    return field
  }

  if (field && typeof field === 'object' && 'nodeType' in field && field.nodeType === 'document') {
    return '[Rich Text Content]'
  }

  return ''
}

function ContentCard({ entry, label, color }: ContentCardProps): React.JSX.Element {
  const title = getFieldText(entry.fields.internalTitle)
  const text = getFieldText(entry.fields.text)
  const isVariant = title.toLowerCase().includes('[variant]')

  return (
    <View style={[styles.card, { backgroundColor: color }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{label}</Text>
        <View style={[styles.badge, isVariant ? styles.variantBadge : styles.baselineBadge]}>
          <Text style={styles.badgeText}>{isVariant ? 'Variant' : 'Baseline'}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{text}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.entryId}>Entry ID: {entry.sys.id}</Text>
        <Text style={styles.contentType}>Type: {entry.sys.contentType.sys.id}</Text>
      </View>
    </View>
  )
}

export function PersonalizationDemoScreen({
  colors,
  onBack,
  demoEntries,
}: PersonalizationDemoScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
      <StatusBar barStyle={useColorScheme() === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { borderBottomColor: colors.mutedTextColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} testID="backButton">
          <Text style={[styles.backButtonText, { color: colors.successColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textColor }]}>Personalization Demo</Text>
      </View>

      <ScrollProvider testID="demoScrollView">
        <View style={[styles.infoSection, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>PreviewPanel Demo</Text>
          <Text style={[styles.sectionText, { color: colors.mutedTextColor }]}>
            Open the PreviewPanel to toggle audience overrides or select specific variants. The
            cards below will update in real-time to show the resolved personalized content.
          </Text>
          <Text style={[styles.sectionText, { color: colors.mutedTextColor, marginTop: 8 }]}>
            Each card represents a different personalization type: Device Type, Visitor Type,
            Location, and Custom Event triggers.
          </Text>
        </View>

        <Personalization
          baselineEntry={demoEntries.deviceType}
          style={styles.personalizationWrapper}
          testID="deviceTypeCard"
        >
          {(resolvedEntry) => (
            <ContentCard
              entry={resolvedEntry}
              label="Device Type Personalization"
              color="#6366f1"
            />
          )}
        </Personalization>

        <Personalization
          baselineEntry={demoEntries.visitorType}
          style={styles.personalizationWrapper}
          testID="visitorTypeCard"
        >
          {(resolvedEntry) => (
            <ContentCard
              entry={resolvedEntry}
              label="Visitor Type Personalization"
              color="#8b5cf6"
            />
          )}
        </Personalization>

        <Personalization
          baselineEntry={demoEntries.location}
          style={styles.personalizationWrapper}
          testID="locationCard"
        >
          {(resolvedEntry) => (
            <ContentCard entry={resolvedEntry} label="Location Personalization" color="#10b981" />
          )}
        </Personalization>

        <Personalization
          baselineEntry={demoEntries.customEvent}
          style={styles.personalizationWrapper}
          testID="customEventCard"
        >
          {(resolvedEntry) => (
            <ContentCard
              entry={resolvedEntry}
              label="Custom Event Personalization"
              color="#f59e0b"
            />
          )}
        </Personalization>

        <View style={styles.bottomSpacer} />
      </ScrollProvider>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 16,
  },
  infoSection: {
    padding: 24,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
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
  personalizationWrapper: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    minHeight: 160,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  baselineBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  variantBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.8)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    marginTop: 'auto',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  entryId: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  contentType: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'monospace',
  },
  bottomSpacer: {
    height: 100,
  },
})

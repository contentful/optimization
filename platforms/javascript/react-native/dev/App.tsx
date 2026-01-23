/**
 * Sample React Native App - Contentful Optimization SDK Implementation
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react'
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import type { MergeTagEntry, Profile } from '@contentful/optimization-react-native'
import { OptimizationRoot } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'
import { createClient } from 'contentful'
import { LoadingScreen } from './components/LoadingScreen'
import { MergeTagDetailCard } from './components/MergeTagDetailCard'
import { SDKConfigCard } from './components/SDKConfigCard'
import { SDKStatusCard } from './components/SDKStatusCard'
import { ENV_CONFIG } from './env.config'
import { PersonalizationDemoScreen } from './PersonalizationDemoScreen'
import { TestTrackingScreen } from './TestTrackingScreen'
import type { SDKInfo, ThemeColors } from './types'
import {
  type DemoEntries,
  fetchDemoEntries,
  fetchEntriesFromMockServer,
  fetchMergeTagEntry,
  initializeSDK,
} from './utils/sdkHelpers'

type ScreenType = 'home' | 'tracking' | 'personalization'

function getThemeColors(isDarkMode: boolean): ThemeColors {
  return {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
    cardBackground: isDarkMode ? '#2d2d2d' : '#ffffff',
    textColor: isDarkMode ? '#ffffff' : '#000000',
    mutedTextColor: isDarkMode ? '#a0a0a0' : '#666666',
    successColor: '#22c55e',
    errorColor: '#ef4444',
    accentColor: '#8b5cf6',
  }
}

interface EntryWithIncludes extends Entry {
  includes?: {
    Entry?: Entry[]
  }
}

function isMergeTagEntry(entry: Entry): entry is MergeTagEntry {
  return entry.sys.contentType.sys.id === 'nt_mergetag'
}

function isRichTextField(field: unknown): field is { nodeType: string } {
  return (
    typeof field === 'object' &&
    field !== null &&
    'nodeType' in field &&
    field.nodeType === 'document'
  )
}

interface EmbeddedNode {
  nodeType: string
  data: { target: { sys: { id: string } } }
  content?: unknown[]
}

// eslint-disable-next-line complexity -- Type guard requires checking multiple nested properties
function isEmbeddedNode(node: unknown): node is EmbeddedNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'nodeType' in node &&
    node.nodeType === 'embedded-entry-inline' &&
    'data' in node &&
    typeof node.data === 'object' &&
    node.data !== null &&
    'target' in node.data &&
    typeof node.data.target === 'object' &&
    node.data.target !== null &&
    'sys' in node.data.target &&
    typeof node.data.target.sys === 'object' &&
    node.data.target.sys !== null &&
    'id' in node.data.target.sys &&
    typeof node.data.target.sys.id === 'string'
  )
}

function findMergeTagEntries(richTextField: {
  nodeType: string
  content?: unknown[]
}): EmbeddedNode[] {
  const embeddedNodes: EmbeddedNode[] = []

  function traverse(node: unknown): void {
    if (typeof node !== 'object' || node === null) return

    if (isEmbeddedNode(node)) {
      embeddedNodes.push(node)
    }

    if ('content' in node && Array.isArray(node.content)) {
      node.content.forEach(traverse)
    }
  }

  traverse(richTextField)
  return embeddedNodes
}

const contentfulClient = createClient({
  space: ENV_CONFIG.contentful.spaceId,
  environment: ENV_CONFIG.contentful.environment,
  accessToken: ENV_CONFIG.contentful.accessToken,
  host: ENV_CONFIG.contentful.host,
  basePath: ENV_CONFIG.contentful.basePath,
  insecure: true,
})

// eslint-disable-next-line complexity -- Main app component requires conditional rendering and state management logic
function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark'
  const colors = getThemeColors(isDarkMode)

  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState<string | null>(null)
  const [sdkInfo, setSdkInfo] = useState<SDKInfo | null>(null)
  const [sdk, setSdk] = useState<Optimization | null>(null)
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home')
  const [personalizedEntry, setPersonalizedEntry] = useState<Entry | null>(null)
  const [productEntry, setProductEntry] = useState<Entry | null>(null)
  const [mergeTagEntry, setMergeTagEntry] = useState<Entry | null>(null)
  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [resolvedValues, setResolvedValues] = useState<Array<{ id: string; value: unknown }>>([])
  const [mergeTagDetails, setMergeTagDetails] = useState<MergeTagEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [demoEntries, setDemoEntries] = useState<DemoEntries | null>(null)
  const [demoEntriesLoading, setDemoEntriesLoading] = useState(false)

  useEffect(() => {
    async function initialize(): Promise<void> {
      await initializeSDK(setSdkInfo, setSdk, setSdkLoaded, setSdkError)
      try {
        await fetchMergeTagEntry(setMergeTagEntry)
      } catch (error) {
        setSdkError(
          `Failed to fetch merge tag: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }
    void initialize()
  }, [])

  useEffect(() => {
    if (!sdk) return

    // Demonstrate direct screen tracking via sdk.screen()
    // This sends a "screen" event to track this screen view
    void sdk.screen({ name: 'Home', properties: { source: 'dev-app-direct' } })

    const subscription = sdk.states.profile.subscribe((currentProfile) => {
      setProfile(currentProfile)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk])

  useEffect(() => {
    if (!mergeTagEntry || !profile || !sdk) return

    const { fields } = mergeTagEntry
    const richTextField = Object.values(fields).find(isRichTextField)

    if (richTextField) {
      const embeddedNodes = findMergeTagEntries(richTextField)
      const entryWithIncludes = mergeTagEntry as EntryWithIncludes
      const includedEntries = entryWithIncludes.includes?.Entry ?? []

      const mergeTagEntriesList: MergeTagEntry[] = []
      const resolvedValuesList: Array<{ id: string; value: unknown }> = []

      embeddedNodes.forEach(
        ({
          data: {
            target: { sys },
          },
        }) => {
          const { id: targetId } = sys
          const includedEntry = includedEntries.find((entry) => entry.sys.id === targetId)

          if (includedEntry && isMergeTagEntry(includedEntry)) {
            mergeTagEntriesList.push(includedEntry)

            const resolvedValue = sdk.personalization.getMergeTagValue(includedEntry, profile)
            const { nt_mergetag_id: mergeTagId } = includedEntry.fields as {
              nt_mergetag_id: string
            }
            resolvedValuesList.push({
              id: mergeTagId,
              value: resolvedValue,
            })
          }
        },
      )

      setMergeTagDetails(mergeTagEntriesList)
      setResolvedValues(resolvedValuesList)
    }
  }, [mergeTagEntry, sdk, profile])

  const fetchEntries = async (): Promise<void> => {
    setEntriesLoading(true)
    try {
      await fetchEntriesFromMockServer(setPersonalizedEntry, setProductEntry)
    } catch (error) {
      setSdkError(
        `Failed to fetch entries: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    } finally {
      setEntriesLoading(false)
    }
  }

  const handleTestTracking = (): void => {
    setCurrentScreen('tracking')
    void fetchEntries()
  }

  const handleDemoPersonalization = (): void => {
    setCurrentScreen('personalization')
    setDemoEntriesLoading(true)
    fetchDemoEntries()
      .then((entries) => {
        setDemoEntries(entries)
      })
      .catch((error: unknown) => {
        setSdkError(
          `Failed to fetch demo entries: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      })
      .finally(() => {
        setDemoEntriesLoading(false)
      })
  }

  const handleBack = (): void => {
    setCurrentScreen('home')
  }

  if (currentScreen === 'personalization' && sdk && demoEntries) {
    return (
      <OptimizationRoot instance={sdk} previewPanel={{ enabled: true, contentfulClient }}>
        <PersonalizationDemoScreen colors={colors} onBack={handleBack} demoEntries={demoEntries} />
      </OptimizationRoot>
    )
  }

  if (currentScreen === 'personalization' && demoEntriesLoading) {
    return <LoadingScreen colors={colors} isDarkMode={isDarkMode} />
  }

  if (currentScreen === 'tracking' && sdk && personalizedEntry && productEntry) {
    return (
      <OptimizationRoot instance={sdk} previewPanel={{ enabled: true, contentfulClient }}>
        <TestTrackingScreen
          colors={colors}
          onBack={handleBack}
          sdk={sdk}
          personalizedEntry={personalizedEntry}
          productEntry={productEntry}
        />
      </OptimizationRoot>
    )
  }

  if (currentScreen === 'tracking' && entriesLoading) {
    return <LoadingScreen colors={colors} isDarkMode={isDarkMode} />
  }

  if (!sdk) {
    return <LoadingScreen colors={colors} isDarkMode={isDarkMode} />
  }

  return (
    <OptimizationRoot instance={sdk} previewPanel={{ enabled: true, contentfulClient }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header} testID="appHeader">
            <Text style={[styles.title, { color: colors.textColor }]} testID="appTitle">
              Contentful Optimization
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedTextColor }]} testID="appSubtitle">
              React Native SDK Implementation
            </Text>
          </View>

          <SDKStatusCard sdkLoaded={sdkLoaded} sdkError={sdkError} colors={colors} />

          {sdkInfo && <SDKConfigCard sdkInfo={sdkInfo} colors={colors} />}
          {mergeTagDetails.length > 0 && (
            <MergeTagDetailCard
              mergeTagDetails={mergeTagDetails}
              resolvedValues={resolvedValues}
              colors={colors}
            />
          )}

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textColor }]}>Component Tracking</Text>
            <Text style={[styles.description, { color: colors.mutedTextColor }]}>
              Test viewport tracking with the Personalization and Analytics components.
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.accentColor }]}
              onPress={handleTestTracking}
              testID="testTrackingButton"
            >
              <Text style={styles.buttonText}>Test Component Tracking</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textColor }]}>
              Personalization Demo
            </Text>
            <Text style={[styles.description, { color: colors.mutedTextColor }]}>
              View personalized content cards that update in real-time when you change variant
              selections in the PreviewPanel.
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#10b981' }]}
              onPress={handleDemoPersonalization}
              testID="demoPersonalizationButton"
            >
              <Text style={styles.buttonText}>Demo Personalization</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </OptimizationRoot>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
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
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default App

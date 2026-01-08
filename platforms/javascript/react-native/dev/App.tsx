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
import { OptimizationProvider } from '@contentful/optimization-react-native'
import type {
  AudienceDefinition,
  ContentfulEntry,
  ExperienceDefinition,
} from '@contentful/optimization-react-native-preview-panel'
import { PreviewPanel } from '@contentful/optimization-react-native-preview-panel'
import type { Entry } from 'contentful'
import { LoadingScreen } from './components/LoadingScreen'
import { MergeTagDetailCard } from './components/MergeTagDetailCard'
import { SDKConfigCard } from './components/SDKConfigCard'
import { SDKStatusCard } from './components/SDKStatusCard'
import { TestTrackingScreen } from './TestTrackingScreen'
import type { SDKInfo, ThemeColors } from './types'
import {
  createAudienceDefinitionsFromEntries,
  createExperienceDefinitionsFromEntries,
  fetchEntriesByContentType,
  fetchEntriesFromMockServer,
  fetchMergeTagEntry,
  initializeSDK,
} from './utils/sdkHelpers'

type ScreenType = 'home' | 'tracking' | 'preview'

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
  const [isIdentified, setIsIdentified] = useState(false)
  const [audienceEntries, setAudienceEntries] = useState<ContentfulEntry[]>([])
  const [experienceEntries, setExperienceEntries] = useState<ContentfulEntry[]>([])
  const [audienceDefinitions, setAudienceDefinitions] = useState<AudienceDefinition[]>([])
  const [experienceDefinitions, setExperienceDefinitions] = useState<ExperienceDefinition[]>([])

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
    async function fetchContentfulEntries(): Promise<void> {
      try {
        const [audiences, experiences] = await Promise.all([
          fetchEntriesByContentType('nt_audience'),
          fetchEntriesByContentType('nt_experience'),
        ])
        const audienceEntriesData = audiences as ContentfulEntry[]
        const experienceEntriesData = experiences as ContentfulEntry[]

        setAudienceEntries(audienceEntriesData)
        setExperienceEntries(experienceEntriesData)

        setAudienceDefinitions(createAudienceDefinitionsFromEntries(audienceEntriesData))
        setExperienceDefinitions(createExperienceDefinitionsFromEntries(experienceEntriesData))
      } catch (_error) {
        // Silently fail - entries may not be available in all environments
      }
    }
    void fetchContentfulEntries()
  }, [])

  useEffect(() => {
    if (!sdk) return

    // Trigger the Experience API to populate profile and personalizations
    void sdk.personalization.page({ properties: { url: 'dev-app' } })

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

  const handleShowPreview = (): void => {
    setCurrentScreen('preview')
  }

  const handleBack = (): void => {
    setCurrentScreen('home')
  }

  const handleIdentify = (): void => {
    if (!sdk) return
    void sdk.personalization.identify({ userId: 'demo-user', traits: { identified: true } })
    setIsIdentified(true)
  }

  const handleReset = (): void => {
    if (!sdk) return
    sdk.reset()
    void sdk.personalization.page({ properties: { url: 'dev-app' } })
    setIsIdentified(false)
  }

  if (currentScreen === 'tracking' && sdk && personalizedEntry && productEntry) {
    return (
      <OptimizationProvider instance={sdk}>
        <TestTrackingScreen
          colors={colors}
          onBack={handleBack}
          sdk={sdk}
          personalizedEntry={personalizedEntry}
          productEntry={productEntry}
        />
      </OptimizationProvider>
    )
  }

  if (currentScreen === 'tracking' && entriesLoading) {
    return <LoadingScreen colors={colors} isDarkMode={isDarkMode} />
  }

  if (currentScreen === 'preview' && sdk) {
    return (
      <OptimizationProvider instance={sdk}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <View style={[styles.previewHeader, { backgroundColor: colors.cardBackground }]}>
            <TouchableOpacity onPress={handleBack} style={styles.backButtonCompact}>
              <Text style={[styles.backButtonText, { color: colors.textColor }]}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.headerActions}>
              {!isIdentified ? (
                <TouchableOpacity
                  style={[styles.headerButton, { backgroundColor: colors.successColor }]}
                  onPress={handleIdentify}
                  testID="identifyButton"
                >
                  <Text style={styles.headerButtonText}>Identify</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.headerButton, { backgroundColor: colors.errorColor }]}
                  onPress={handleReset}
                  testID="resetButton"
                >
                  <Text style={styles.headerButtonText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <PreviewPanel
            showHeader={true}
            audienceDefinitions={audienceDefinitions}
            experienceDefinitions={experienceDefinitions}
            audienceEntries={audienceEntries}
            experienceEntries={experienceEntries}
          />
        </SafeAreaView>
      </OptimizationProvider>
    )
  }

  if (!sdk) {
    return <LoadingScreen colors={colors} isDarkMode={isDarkMode} />
  }

  return (
    <OptimizationProvider instance={sdk}>
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
            <Text style={[styles.cardTitle, { color: colors.textColor }]}>Preview Panel</Text>
            <Text style={[styles.description, { color: colors.mutedTextColor }]}>
              Debug and inspect the SDK state, profile, personalizations, and overrides.
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#007AFF' }]}
              onPress={handleShowPreview}
              testID="previewPanelButton"
            >
              <Text style={styles.buttonText}>Open Preview Panel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </OptimizationProvider>
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
  backButton: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButtonCompact: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  headerButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
})

export default App

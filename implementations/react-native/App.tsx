/**
 * Sample React Native App - Contentful Optimization SDK Demo
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native'

import Optimization, { OptimizationProvider } from '@contentful/optimization-react-native'
import { createClient, type Entry } from 'contentful'
import { ENV_CONFIG } from './env.config'
import { TestTrackingScreen } from './TestTrackingScreen'

interface SDKInfo {
  clientId: string
  environment: string
  initialized: boolean
  timestamp: string
}

interface ThemeColors {
  backgroundColor: string
  cardBackground: string
  textColor: string
  mutedTextColor: string
  successColor: string
  errorColor: string
}

interface SDKStatusCardProps {
  sdkLoaded: boolean
  sdkError: string | null
  colors: ThemeColors
}

interface SDKConfigCardProps {
  sdkInfo: SDKInfo
  colors: ThemeColors
}

interface InstructionsCardProps {
  colors: ThemeColors
  onTestTracking: () => void
}

interface LoadingScreenProps {
  colors: ThemeColors
  isDarkMode: boolean
}

interface MainScreenProps {
  colors: ThemeColors
  isDarkMode: boolean
  sdkLoaded: boolean
  sdkError: string | null
  sdkInfo: SDKInfo | null
  onTestTracking: () => void
}

function SDKStatusCard({ sdkLoaded, sdkError, colors }: SDKStatusCardProps): React.JSX.Element {
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

function SDKConfigCard({ sdkInfo, colors }: SDKConfigCardProps): React.JSX.Element {
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

function InstructionsCard({ colors, onTestTracking }: InstructionsCardProps): React.JSX.Element {
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
    </View>
  )
}

function LoadingScreen({ colors, isDarkMode }: LoadingScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.successColor} />
        <Text style={[styles.loadingText, { color: colors.textColor }]}>
          Loading entries from mock server...
        </Text>
      </View>
    </SafeAreaView>
  )
}

function MainScreen({
  colors,
  isDarkMode,
  sdkLoaded,
  sdkError,
  sdkInfo,
  onTestTracking,
}: MainScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header} testID="appHeader">
          <Text style={[styles.title, { color: colors.textColor }]} testID="appTitle">
            Contentful Optimization
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedTextColor }]} testID="appSubtitle">
            React Native SDK Demo
          </Text>
        </View>

        <SDKStatusCard sdkLoaded={sdkLoaded} sdkError={sdkError} colors={colors} />

        {sdkInfo && <SDKConfigCard sdkInfo={sdkInfo} colors={colors} />}

        <InstructionsCard colors={colors} onTestTracking={onTestTracking} />
      </ScrollView>
    </SafeAreaView>
  )
}

// Initialize the Optimization SDK
async function initializeSDK(
  setSdkInfo: (info: SDKInfo) => void,
  setSdk: (sdk: Optimization) => void,
  setSdkLoaded: (loaded: boolean) => void,
  setSdkError: (error: string | null) => void,
): Promise<void> {
  try {
    const {
      optimization: { clientId, environment },
      api: { experienceBaseUrl, insightsBaseUrl },
    } = ENV_CONFIG

    const sdkInstance = await Optimization.create({
      clientId,
      environment,
      api: {
        personalization: { baseUrl: experienceBaseUrl },
        analytics: { baseUrl: insightsBaseUrl },
      },
    })

    setSdkInfo({
      clientId,
      environment,
      initialized: true,
      timestamp: new Date().toISOString(),
    })
    setSdk(sdkInstance)
    setSdkLoaded(true)
  } catch (error) {
    setSdkError(error instanceof Error ? error.message : 'Unknown error')
  }
}

// Fetch entries from mock server
async function fetchEntriesFromMockServer(
  setPersonalizedEntry: (entry: Entry) => void,
  setProductEntry: (entry: Entry) => void,
): Promise<void> {
  const {
    contentful: { spaceId, environment, accessToken, host, basePath },
    entries: { personalized, product },
  } = ENV_CONFIG

  const contentful = createClient({
    space: spaceId,
    environment,
    accessToken,
    host,
    basePath,
    insecure: true,
  })

  const [personalizedEntryData, productEntryData] = await Promise.all([
    contentful.getEntry(personalized, { include: 10 }),
    contentful.getEntry(product, { include: 10 }),
  ])

  setPersonalizedEntry(personalizedEntryData)
  setProductEntry(productEntryData)
}

// eslint-disable-next-line complexity -- Main app component, complexity is minimal after refactoring
function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark'

  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState<string | null>(null)
  const [sdkInfo, setSdkInfo] = useState<SDKInfo | null>(null)
  const [sdk, setSdk] = useState<Optimization | null>(null)
  const [showTestScreen, setShowTestScreen] = useState(false)
  const [personalizedEntry, setPersonalizedEntry] = useState<Entry | null>(null)
  const [productEntry, setProductEntry] = useState<Entry | null>(null)
  const [entriesLoading, setEntriesLoading] = useState(false)

  useEffect(() => {
    void initializeSDK(setSdkInfo, setSdk, setSdkLoaded, setSdkError)
  }, [])

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

  const colors: ThemeColors = {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
    cardBackground: isDarkMode ? '#2d2d2d' : '#ffffff',
    textColor: isDarkMode ? '#ffffff' : '#000000',
    mutedTextColor: isDarkMode ? '#a0a0a0' : '#666666',
    successColor: '#22c55e',
    errorColor: '#ef4444',
  }

  const handleTestTracking = (): void => {
    setShowTestScreen(true)
    void fetchEntries()
  }

  const handleBack = (): void => {
    setShowTestScreen(false)
  }

  // Show test screen if requested and data is available
  if (showTestScreen && sdk && personalizedEntry && productEntry) {
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

  // Show loading screen while fetching entries
  if (showTestScreen && entriesLoading) {
    return <LoadingScreen colors={colors} isDarkMode={isDarkMode} />
  }

  // Main screen
  return (
    <MainScreen
      colors={colors}
      isDarkMode={isDarkMode}
      sdkLoaded={sdkLoaded}
      sdkError={sdkError}
      sdkInfo={sdkInfo}
      onTestTracking={handleTestTracking}
    />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
})

export default App

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

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark'

  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState<string | null>(null)
  const [sdkInfo, setSdkInfo] = useState<SDKInfo | null>(null)
  const [sdk, setSdk] = useState<Optimization | null>(null)
  const [showTestScreen, setShowTestScreen] = useState(false)

  useEffect(() => {
    const initSDK = async (): Promise<void> => {
      try {
        const clientId = process.env.NINETAILED_CLIENT_ID ?? 'test-client-id'
        const environment = process.env.NINETAILED_ENVIRONMENT ?? 'main'

        // Initialize the Optimization SDK
        const sdkInstance = await Optimization.create({
          clientId,
          environment,
        })

        // Store SDK info for display
        setSdkInfo({
          clientId,
          environment,
          initialized: true,
          timestamp: new Date().toISOString(),
        })

        // Store SDK instance
        setSdk(sdkInstance)

        // Mark SDK as loaded
        setSdkLoaded(true)
      } catch (error) {
        setSdkError(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    void initSDK()
  }, [])

  const colors: ThemeColors = {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
    cardBackground: isDarkMode ? '#2d2d2d' : '#ffffff',
    textColor: isDarkMode ? '#ffffff' : '#000000',
    mutedTextColor: isDarkMode ? '#a0a0a0' : '#666666',
    successColor: '#22c55e',
    errorColor: '#ef4444',
  }

  // Show test screen if requested and SDK is loaded
  if (showTestScreen && sdk) {
    return (
      <OptimizationProvider instance={sdk}>
        <TestTrackingScreen
          colors={colors}
          onBack={() => {
            setShowTestScreen(false)
          }}
          sdk={sdk}
        />
      </OptimizationProvider>
    )
  }

  // Main screen
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

        <InstructionsCard
          colors={colors}
          onTestTracking={() => {
            setShowTestScreen(true)
          }}
        />
      </ScrollView>
    </SafeAreaView>
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
})

export default App

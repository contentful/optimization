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
  useColorScheme,
  View,
} from 'react-native'

import Optimization from '@contentful/optimization-react-native'

interface SDKInfo {
  clientId: string
  environment: string
  initialized: boolean
  timestamp: string
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark'

  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState<string | null>(null)
  const [sdkInfo, setSdkInfo] = useState<SDKInfo | null>(null)

  useEffect(() => {
    const initSDK = async (): Promise<void> => {
      try {
        const clientId = process.env.VITE_NINETAILED_CLIENT_ID ?? 'test-client-id'
        const environment = process.env.VITE_NINETAILED_ENVIRONMENT ?? 'main'

        // Initialize the Optimization SDK
        await Optimization.create({
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

        // Mark SDK as loaded
        setSdkLoaded(true)
      } catch (error) {
        setSdkError(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    void initSDK()
  }, [])

  const backgroundColor = isDarkMode ? '#1a1a1a' : '#f5f5f5'
  const cardBackground = isDarkMode ? '#2d2d2d' : '#ffffff'
  const textColor = isDarkMode ? '#ffffff' : '#000000'
  const mutedTextColor = isDarkMode ? '#a0a0a0' : '#666666'
  const successColor = '#22c55e'
  const errorColor = '#ef4444'

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: textColor }]}>Contentful Optimization</Text>
          <Text style={[styles.subtitle, { color: mutedTextColor }]}>React Native SDK Demo</Text>
        </View>

        {/* SDK Status Card */}
        <View style={[styles.card, { backgroundColor: cardBackground }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>SDK Status</Text>

          {!sdkLoaded && !sdkError && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={successColor} />
              <Text style={[styles.statusText, { color: mutedTextColor }]}>
                Initializing SDK...
              </Text>
            </View>
          )}

          {sdkLoaded && (
            <View style={styles.statusRow}>
              <View style={[styles.statusIndicator, { backgroundColor: successColor }]} />
              <Text style={[styles.statusText, { color: successColor }]}>
                ✓ SDK Loaded Successfully
              </Text>
            </View>
          )}

          {sdkError && (
            <View style={styles.statusRow}>
              <View style={[styles.statusIndicator, { backgroundColor: errorColor }]} />
              <Text style={[styles.statusText, { color: errorColor }]}>✗ Error: {sdkError}</Text>
            </View>
          )}
        </View>

        {/* SDK Configuration */}
        {sdkInfo && (
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Configuration</Text>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: mutedTextColor }]}>Client ID:</Text>
              <Text style={[styles.infoValue, { color: textColor }]}>{sdkInfo.clientId}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: mutedTextColor }]}>Environment:</Text>
              <Text style={[styles.infoValue, { color: textColor }]}>{sdkInfo.environment}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: mutedTextColor }]}>Initialized At:</Text>
              <Text style={[styles.infoValue, { color: textColor }]}>
                {new Date(sdkInfo.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={[styles.card, { backgroundColor: cardBackground }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Next Steps</Text>
          <Text style={[styles.instructionText, { color: mutedTextColor }]}>
            • The Optimization SDK is now initialized and ready to use{'\n'}• You can now implement
            experiences and personalization{'\n'}• Check the console for additional SDK logs{'\n'}•
            Modify this app to test SDK features
          </Text>
        </View>
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
})

export default App

/**
 * Sample React Native App - Contentful Optimization SDK Implementation
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import { OptimizationProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'
import { LoadingScreen } from './components/LoadingScreen'
import { MainScreen } from './components/MainScreen'
import { MergeTagScreen } from './screens/MergeTagScreen'
import { TestTrackingScreen } from './TestTrackingScreen'
import type { SDKInfo, ThemeColors } from './types'
import { fetchEntriesFromMockServer, fetchMergeTagEntry, initializeSDK } from './utils/sdkHelpers'

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

// eslint-disable-next-line complexity -- Main app component requires conditional rendering logic
function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark'

  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [sdkError, setSdkError] = useState<string | null>(null)
  const [sdkInfo, setSdkInfo] = useState<SDKInfo | null>(null)
  const [sdk, setSdk] = useState<Optimization | null>(null)
  const [showTestScreen, setShowTestScreen] = useState(false)
  const [showMergeTagScreen, setShowMergeTagScreen] = useState(false)
  const [personalizedEntry, setPersonalizedEntry] = useState<Entry | null>(null)
  const [productEntry, setProductEntry] = useState<Entry | null>(null)
  const [mergeTagEntry, setMergeTagEntry] = useState<Entry | null>(null)
  const [entriesLoading, setEntriesLoading] = useState(false)

  useEffect(() => {
    void initializeSDK(setSdkInfo, setSdk, setSdkLoaded, setSdkError)
  }, [])

  const fetchWithErrorHandling = async (
    fetchFn: () => Promise<void>,
    errorMsg: string,
  ): Promise<void> => {
    setEntriesLoading(true)
    try {
      await fetchFn()
    } catch (error) {
      setSdkError(`${errorMsg}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setEntriesLoading(false)
    }
  }

  const fetchEntries = async (): Promise<void> => {
    await fetchWithErrorHandling(async () => {
      await fetchEntriesFromMockServer(setPersonalizedEntry, setProductEntry)
    }, 'Failed to fetch entries')
  }

  const fetchMergeTag = async (): Promise<void> => {
    await fetchWithErrorHandling(async () => {
      await fetchMergeTagEntry(setMergeTagEntry)
    }, 'Failed to fetch merge tag entry')
  }

  const colors = getThemeColors(isDarkMode)

  const handleTestTracking = (): void => {
    setShowTestScreen(true)
    void fetchEntries()
  }

  const handleTestMergeTags = (): void => {
    setShowMergeTagScreen(true)
    void fetchMergeTag()
  }

  const handleBack = (): void => {
    setShowTestScreen(false)
    setShowMergeTagScreen(false)
  }

  if (showMergeTagScreen && sdk && mergeTagEntry) {
    return (
      <OptimizationProvider instance={sdk}>
        <MergeTagScreen
          colors={colors}
          onBack={handleBack}
          sdk={sdk}
          mergeTagEntry={mergeTagEntry}
        />
      </OptimizationProvider>
    )
  }

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

  if ((showTestScreen || showMergeTagScreen) && entriesLoading) {
    return <LoadingScreen colors={colors} isDarkMode={isDarkMode} />
  }

  return (
    <MainScreen
      colors={colors}
      isDarkMode={isDarkMode}
      sdkLoaded={sdkLoaded}
      sdkError={sdkError}
      sdkInfo={sdkInfo}
      onTestTracking={handleTestTracking}
      onTestMergeTags={handleTestMergeTags}
    />
  )
}

export default App

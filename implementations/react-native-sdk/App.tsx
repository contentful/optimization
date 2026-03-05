import React, { useEffect, useState } from 'react'
import { Button, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  OptimizationProvider,
  OptimizationScrollProvider,
  useOptimization,
} from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

import { AnalyticsEventDisplay } from './components/AnalyticsEventDisplay'
import { ENV_CONFIG } from './env.config'
import { LiveUpdatesTestScreen } from './screens/LiveUpdatesTestScreen'
import { NavigationTestScreen } from './screens/NavigationTestScreen'
import { ContentEntry } from './sections/ContentEntry'
import { NestedContentEntry } from './sections/NestedContentEntry'
import { fetchEntries } from './utils/sdkHelpers'

const ENTRY_IDS = [
  ENV_CONFIG.entries.mergeTag,
  '4ib0hsHWoSOnCVdDkizE8d',
  'xFwgG3oNaOcjzWiGe4vXo',
  ENV_CONFIG.entries.personalized,
  '5XHssysWUDECHzKLzoIsg1',
  '6zqoWXyiSrf0ja7I2WGtYj',
  '7pa5bOx8Z9NmNcr7mISvD',
  ENV_CONFIG.entries.nested,
]

function AppContent(): React.JSX.Element {
  const sdk = useOptimization()
  const [entries, setEntries] = useState<Entry[]>([])
  const [sdkError, setSdkError] = useState<string | null>(null)
  const [isIdentified, setIsIdentified] = useState<boolean>(false)
  const [showNavigationTest, setShowNavigationTest] = useState<boolean>(false)
  const [showLiveUpdatesTest, setShowLiveUpdatesTest] = useState<boolean>(false)

  useEffect(() => {
    void sdk.page({ properties: { url: 'app' } })

    const subscription = sdk.states.profile.subscribe((profile) => {
      if (!profile) {
        return
      }

      void fetchEntries(ENTRY_IDS, setEntries, setSdkError)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk])

  const handleIdentify = (): void => {
    void sdk.identify({ userId: 'charles', traits: { identified: true } })
    setIsIdentified(true)
  }

  const handleReset = (): void => {
    sdk.reset()
    void sdk.page({ properties: { url: 'app' } })
    setIsIdentified(false)
  }

  if (sdkError) {
    return <Text>{sdkError}</Text>
  }

  if (entries.length === 0) {
    return <Text>Loading...</Text>
  }

  if (showNavigationTest) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <NavigationTestScreen
          onClose={() => {
            setShowNavigationTest(false)
          }}
        />
      </SafeAreaView>
    )
  }

  if (showLiveUpdatesTest) {
    return (
      <LiveUpdatesTestScreen
        onClose={() => {
          setShowLiveUpdatesTest(false)
        }}
      />
    )
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: 10, gap: 10, flexDirection: 'row', flexWrap: 'wrap' }}>
        {!isIdentified ? (
          <Button testID="identify-button" title="Identify" onPress={handleIdentify} />
        ) : (
          <Button testID="reset-button" title="Reset" onPress={handleReset} />
        )}
        <Button
          testID="navigation-test-button"
          title="Navigation Test"
          onPress={() => {
            setShowNavigationTest(true)
          }}
        />
        <Button
          testID="live-updates-test-button"
          title="Live Updates Test"
          onPress={() => {
            setShowLiveUpdatesTest(true)
          }}
        />
      </View>
      <OptimizationScrollProvider testID="main-scroll-view">
        {entries.map((entry) =>
          entry.sys.contentType.sys.id === 'nestedContent' ? (
            <NestedContentEntry key={entry.sys.id} entry={entry} />
          ) : (
            <ContentEntry key={entry.sys.id} entry={entry} />
          ),
        )}
        <AnalyticsEventDisplay />
      </OptimizationScrollProvider>
    </SafeAreaView>
  )
}

function App(): React.JSX.Element {
  return (
    <OptimizationProvider
      clientId={ENV_CONFIG.optimization.clientId}
      environment={ENV_CONFIG.optimization.environment}
      personalization={{ baseUrl: ENV_CONFIG.api.experienceBaseUrl }}
      analytics={{ baseUrl: ENV_CONFIG.api.insightsBaseUrl }}
      logLevel="debug"
    >
      <AppContent />
    </OptimizationProvider>
  )
}

export default App

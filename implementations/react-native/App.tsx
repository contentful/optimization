import React, { useEffect, useState } from 'react'
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import { OptimizationProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

import { AnalyticsEventDisplay } from './components/AnalyticsEventDisplay'
import { ENV_CONFIG } from './env.config'
import { NavigationTestScreen } from './screens/NavigationTestScreen'
import { ContentEntry } from './sections/ContentEntry'
import { NestedContentEntry } from './sections/NestedContentEntry'
import { fetchEntries, initializeSDK } from './utils/sdkHelpers'

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

function App(): React.JSX.Element {
  const [sdk, setSdk] = useState<Optimization | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [sdkError, setSdkError] = useState<string | null>(null)
  const [isIdentified, setIsIdentified] = useState<boolean>(false)
  const [showNavigationTest, setShowNavigationTest] = useState<boolean>(false)

  useEffect(() => {
    void initializeSDK(setSdk, setSdkError)
  }, [])

  useEffect(() => {
    if (!sdk) {
      return
    }

    void sdk.personalization.page({ properties: { url: 'app' } })

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
    if (!sdk) return

    void sdk.personalization.identify({ userId: 'charles', traits: { identified: true } })
    setIsIdentified(true)
  }

  const handleReset = (): void => {
    if (!sdk) return

    sdk.reset()
    void sdk.personalization.page({ properties: { url: 'app' } })
    setIsIdentified(false)
  }

  if (sdkError) {
    return <Text>{sdkError}</Text>
  }

  if (!sdk || entries.length === 0) {
    return <Text>Loading...</Text>
  }

  if (showNavigationTest) {
    return (
      <OptimizationProvider instance={sdk}>
        <SafeAreaView style={{ flex: 1 }}>
          <NavigationTestScreen
            onClose={() => {
              setShowNavigationTest(false)
            }}
          />
        </SafeAreaView>
      </OptimizationProvider>
    )
  }

  return (
    <OptimizationProvider instance={sdk}>
      <SafeAreaView>
        <View style={{ padding: 10, gap: 10, flexDirection: 'row' }}>
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
        </View>
        <ScrollView>
          {entries.map((entry) =>
            entry.sys.contentType.sys.id === 'nestedContent' ? (
              <NestedContentEntry key={entry.sys.id} entry={entry} />
            ) : (
              <ContentEntry key={entry.sys.id} entry={entry} sdk={sdk} />
            ),
          )}
        </ScrollView>
        <View>
          <AnalyticsEventDisplay sdk={sdk} />
        </View>
      </SafeAreaView>
    </OptimizationProvider>
  )
}

export default App

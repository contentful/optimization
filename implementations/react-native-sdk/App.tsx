import React, { useEffect, useMemo, useState } from 'react'
import { Button, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  OptimizationProvider,
  OptimizationScrollProvider,
  PreviewPanelOverlay,
  useOptimization,
} from '@contentful/optimization-react-native'
import { createClient, type Entry } from 'contentful'

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
  ENV_CONFIG.entries.optimized,
  '5XHssysWUDECHzKLzoIsg1',
  '6zqoWXyiSrf0ja7I2WGtYj',
  '7pa5bOx8Z9NmNcr7mISvD',
  ENV_CONFIG.entries.nested,
]

function AppContent(): React.JSX.Element {
  const sdk = useOptimization()
  const contentfulClient = useMemo(
    () =>
      createClient({
        space: ENV_CONFIG.contentful.spaceId,
        environment: ENV_CONFIG.contentful.environment,
        accessToken: ENV_CONFIG.contentful.accessToken,
        host: ENV_CONFIG.contentful.host,
        basePath: ENV_CONFIG.contentful.basePath,
        insecure: true,
      }),
    [],
  )
  const [entries, setEntries] = useState<Entry[]>([])
  const [sdkError, setSdkError] = useState<string | null>(null)
  const [hasConsent, setHasConsent] = useState<boolean>(false)
  const [hasProfile, setHasProfile] = useState<boolean>(false)
  const [isIdentified, setIsIdentified] = useState<boolean>(false)
  const [showNavigationTest, setShowNavigationTest] = useState<boolean>(false)
  const [showLiveUpdatesTest, setShowLiveUpdatesTest] = useState<boolean>(false)

  useEffect(() => {
    sdk.consent(true)
    void sdk.page({ properties: { url: 'app' } })

    const subscription = sdk.states.profile.subscribe((profile) => {
      setHasProfile(profile !== undefined)

      if (!profile) {
        return
      }

      void fetchEntries(ENTRY_IDS, setEntries, setSdkError)
    })

    const consentSubscription = sdk.states.consent.subscribe((consent) => {
      setHasConsent(consent === true)
    })

    return () => {
      subscription.unsubscribe()
      consentSubscription.unsubscribe()
    }
  }, [sdk])

  useEffect(() => {
    if (!hasConsent || !hasProfile) {
      return
    }

    const flagSubscription = sdk.states.flag('boolean').subscribe(() => undefined)

    return () => {
      flagSubscription.unsubscribe()
    }
  }, [hasConsent, hasProfile, sdk])

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
    <PreviewPanelOverlay contentfulClient={contentfulClient}>
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
    </PreviewPanelOverlay>
  )
}

function App(): React.JSX.Element {
  return (
    <OptimizationProvider {...ENV_CONFIG.optimization} logLevel="debug">
      <AppContent />
    </OptimizationProvider>
  )
}

export default App

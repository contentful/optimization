import React, { useEffect, useState } from 'react'
import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import type { Profile } from '@contentful/optimization-react-native'
import { OptimizationProvider, logger } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'
import { AnalyticsSection } from './sections/AnalyticsSection'
import { MergeTagSection } from './sections/MergeTagSection'
import { PersonalizationSection } from './sections/PersonalizationSection'
import {
  fetchAnalyticsEntry,
  fetchMergeTagEntry,
  fetchPersonalizationEntry,
  initializeSDK,
} from './utils/sdkHelpers'

function App(): React.JSX.Element {
  const [sdk, setSdk] = useState<Optimization | null>(null)
  const [mergeTagEntry, setMergeTagEntry] = useState<Entry | null>(null)
  const [personalizationEntry, setPersonalizationEntry] = useState<Entry | null>(null)
  const [analyticsEntry, setAnalyticsEntry] = useState<Entry | null>(null)
  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [sdkError, setSdkError] = useState<string | null>(null)

  useEffect(() => {
    void initializeSDK(setSdk, setSdkError)
  }, [])

  useEffect(() => {
    if (!sdk) {
      logger.debug('[App] SDK not initialized')
      return
    }

    logger.debug('[App] Triggering profile creation by calling page()')
    void sdk.personalization.page({ properties: { url: 'app' } })

    const subscription = sdk.states.profile.subscribe((currentProfile) => {
      if (!currentProfile) {
        logger.debug('[App] Profile is undefined')
        return
      }

      logger.debug(
        `[App] Profile received: ID: ${currentProfile.id}, location.continent: ${String(currentProfile.location.continent)}`,
      )
      setProfile(currentProfile)
      fetchMergeTagEntry(setMergeTagEntry, setSdkError).catch(() => undefined)
      fetchPersonalizationEntry(setPersonalizationEntry, setSdkError).catch(() => undefined)
      fetchAnalyticsEntry(setAnalyticsEntry, setSdkError).catch(() => undefined)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk])

  if (sdkError) {
    return <Text>{sdkError}</Text>
  }

  if (!sdk) {
    return <Text>Loading SDK...</Text>
  }

  const isLoading = !mergeTagEntry || !personalizationEntry || !analyticsEntry

  if (isLoading) {
    return <Text>Loading entries...</Text>
  }

  if (!profile) {
    return <Text>Loading profile...</Text>
  }

  return (
    <OptimizationProvider instance={sdk}>
      <SafeAreaView style={styles.container}>
        <ScrollView>
          <MergeTagSection sdk={sdk} mergeTagEntry={mergeTagEntry} profile={profile} />
          <PersonalizationSection sdk={sdk} personalizationEntry={personalizationEntry} />
          <AnalyticsSection sdk={sdk} analyticsEntry={analyticsEntry} />
        </ScrollView>
      </SafeAreaView>
    </OptimizationProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

export default App

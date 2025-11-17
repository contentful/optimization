import React, { useEffect, useState } from 'react'
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import { OptimizationProvider } from '@contentful/optimization-react-native'
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
  const [sdkError, setSdkError] = useState<string | null>(null)

  useEffect(() => {
    void initializeSDK(setSdk, setSdkError)
  }, [])

  useEffect(() => {
    if (sdk) {
      fetchMergeTagEntry(setMergeTagEntry, setSdkError).catch(() => undefined)
      fetchPersonalizationEntry(setPersonalizationEntry, setSdkError).catch(() => undefined)
      fetchAnalyticsEntry(setAnalyticsEntry, setSdkError).catch(() => undefined)
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

  return (
    <OptimizationProvider instance={sdk}>
      <SafeAreaView style={styles.container}>
        <ScrollView>
          <View testID="merge-tag-section">
            <MergeTagSection sdk={sdk} mergeTagEntry={mergeTagEntry} />
          </View>
          <View testID="personalization-section">
            <PersonalizationSection sdk={sdk} personalizationEntry={personalizationEntry} />
          </View>
          <View testID="analytics-section">
            <AnalyticsSection sdk={sdk} analyticsEntry={analyticsEntry} />
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
})

export default App

import React, { useEffect, useState } from 'react'
import { SafeAreaView, StyleSheet, Text } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import { OptimizationProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

import { MergeTagScreen } from './screens/MergeTagScreen'
import { fetchMergeTagEntry, initializeSDK } from './utils/sdkHelpers'

function App(): React.JSX.Element {
  const [sdk, setSdk] = useState<Optimization | null>(null)
  const [mergeTagEntry, setMergeTagEntry] = useState<Entry | null>(null)
  const [sdkError, setSdkError] = useState<string | null>(null)

  useEffect(() => {
    void initializeSDK(setSdk, setSdkError)
  }, [])

  useEffect(() => {
    if (sdk) {
      void fetchMergeTagEntry(setMergeTagEntry, setSdkError)
    }
  }, [sdk])

  if (sdkError) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>{sdkError}</Text>
      </SafeAreaView>
    )
  }

  if (!sdk || !mergeTagEntry) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    )
  }

  return (
    <OptimizationProvider instance={sdk}>
      <MergeTagScreen sdk={sdk} mergeTagEntry={mergeTagEntry} />
    </OptimizationProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export default App

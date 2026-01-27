import React, { useEffect, useState } from 'react'
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import {
  OptimizationRoot,
  Personalization,
  ScrollProvider,
  useLiveUpdates,
} from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

import { LiveUpdatesEntryDisplay } from '../components/LiveUpdatesEntryDisplay'
import { ENV_CONFIG } from '../env.config'
import { fetchEntries } from '../utils/sdkHelpers'

interface LiveUpdatesTestScreenProps {
  sdk: Optimization
  onClose: () => void
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  controlPanel: {
    padding: 16,
    backgroundColor: '#e8e8e8',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  controlPanelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
  },
  statusValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  loadingText: {
    padding: 16,
    textAlign: 'center',
  },
})

interface ContentSectionsProps {
  entry: Entry
  onSimulatePreviewPanel: () => void
  isPreviewPanelSimulated: boolean
}

function ContentSections({
  entry,
  onSimulatePreviewPanel,
  isPreviewPanelSimulated,
}: ContentSectionsProps): React.JSX.Element {
  const liveUpdatesContext = useLiveUpdates()

  return (
    <>
      <View style={styles.controlPanel}>
        <View style={styles.buttonRow}>
          <Button
            testID="simulate-preview-panel-button"
            title={isPreviewPanelSimulated ? 'Close Preview Panel' : 'Simulate Preview Panel'}
            onPress={onSimulatePreviewPanel}
          />
        </View>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Preview Panel:</Text>
            <Text
              testID="preview-panel-status"
              style={[
                styles.statusValue,
                { color: liveUpdatesContext?.previewPanelVisible ? 'green' : 'red' },
              ]}
            >
              {liveUpdatesContext?.previewPanelVisible ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView testID="live-updates-scroll-view">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Behavior (inherits global setting)</Text>
          <Text style={styles.sectionDescription}>
            No liveUpdates prop - inherits from OptimizationRoot (false)
          </Text>
          <ScrollProvider>
            <Personalization baselineEntry={entry} testID="default-personalization">
              {(resolvedEntry) => (
                <LiveUpdatesEntryDisplay entry={resolvedEntry} testIdPrefix="default" />
              )}
            </Personalization>
          </ScrollProvider>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Updates Enabled (liveUpdates=true)</Text>
          <Text style={styles.sectionDescription}>
            Always updates when personalization state changes
          </Text>
          <ScrollProvider>
            <Personalization baselineEntry={entry} liveUpdates={true} testID="live-personalization">
              {(resolvedEntry) => (
                <LiveUpdatesEntryDisplay entry={resolvedEntry} testIdPrefix="live" />
              )}
            </Personalization>
          </ScrollProvider>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Locked (liveUpdates=false)</Text>
          <Text style={styles.sectionDescription}>
            Never updates - locks to first variant received
          </Text>
          <ScrollProvider>
            <Personalization
              baselineEntry={entry}
              liveUpdates={false}
              testID="locked-personalization"
            >
              {(resolvedEntry) => (
                <LiveUpdatesEntryDisplay entry={resolvedEntry} testIdPrefix="locked" />
              )}
            </Personalization>
          </ScrollProvider>
        </View>
      </ScrollView>
    </>
  )
}

export function LiveUpdatesTestScreen({
  sdk,
  onClose,
}: LiveUpdatesTestScreenProps): React.JSX.Element {
  const [entry, setEntry] = useState<Entry | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isIdentified, setIsIdentified] = useState(false)
  const [globalLiveUpdates, setGlobalLiveUpdates] = useState(false)
  const [isPreviewPanelSimulated, setIsPreviewPanelSimulated] = useState(false)

  useEffect(() => {
    const loadEntry = async (): Promise<void> => {
      setIsLoading(true)
      await fetchEntries(
        [ENV_CONFIG.entries.personalized],
        (entries) => {
          if (entries.length > 0) {
            setEntry(entries[0])
          } else {
            setError('No entry found')
          }
          setIsLoading(false)
        },
        (err) => {
          setError(err)
          setIsLoading(false)
        },
      )
    }

    void loadEntry()
  }, [])

  const handleIdentify = (): void => {
    void sdk.personalization.identify({ userId: 'charles', traits: { identified: true } })
    setIsIdentified(true)
  }

  const handleReset = (): void => {
    sdk.reset()
    void sdk.personalization.page({ properties: { url: 'live-updates-test' } })
    setIsIdentified(false)
  }

  const handleToggleGlobalLiveUpdates = (): void => {
    setGlobalLiveUpdates((prev) => !prev)
  }

  const handleSimulatePreviewPanel = (): void => {
    setIsPreviewPanelSimulated((prev) => !prev)
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>{error}</Text>
        <Button testID="close-live-updates-test-button" title="Close" onPress={onClose} />
      </SafeAreaView>
    )
  }

  if (isLoading || !entry) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    )
  }

  return (
    <OptimizationRoot
      instance={sdk}
      liveUpdates={globalLiveUpdates}
      key={`${globalLiveUpdates}-${isPreviewPanelSimulated}`}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.controlPanel}>
          <Text style={styles.controlPanelTitle}>Live Updates Test Controls</Text>
          <View style={styles.buttonRow}>
            <Button testID="close-live-updates-test-button" title="Close" onPress={onClose} />
            {!isIdentified ? (
              <Button
                testID="live-updates-identify-button"
                title="Identify"
                onPress={handleIdentify}
              />
            ) : (
              <Button testID="live-updates-reset-button" title="Reset" onPress={handleReset} />
            )}
            <Button
              testID="toggle-global-live-updates-button"
              title={`Global: ${globalLiveUpdates ? 'ON' : 'OFF'}`}
              onPress={handleToggleGlobalLiveUpdates}
            />
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Identified:</Text>
              <Text
                testID="identified-status"
                style={[styles.statusValue, { color: isIdentified ? 'green' : 'red' }]}
              >
                {isIdentified ? 'Yes' : 'No'}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Global Live Updates:</Text>
              <Text
                testID="global-live-updates-status"
                style={[styles.statusValue, { color: globalLiveUpdates ? 'green' : 'red' }]}
              >
                {globalLiveUpdates ? 'ON' : 'OFF'}
              </Text>
            </View>
          </View>
        </View>

        <ContentSectionsWithPreviewSimulation
          entry={entry}
          isPreviewPanelSimulated={isPreviewPanelSimulated}
          onSimulatePreviewPanel={handleSimulatePreviewPanel}
        />
      </SafeAreaView>
    </OptimizationRoot>
  )
}

interface ContentSectionsWithPreviewSimulationProps {
  entry: Entry
  isPreviewPanelSimulated: boolean
  onSimulatePreviewPanel: () => void
}

function ContentSectionsWithPreviewSimulation({
  entry,
  isPreviewPanelSimulated,
  onSimulatePreviewPanel,
}: ContentSectionsWithPreviewSimulationProps): React.JSX.Element {
  const liveUpdatesContext = useLiveUpdates()

  useEffect(() => {
    liveUpdatesContext?.setPreviewPanelVisible(isPreviewPanelSimulated)
  }, [isPreviewPanelSimulated, liveUpdatesContext])

  return (
    <ContentSections
      entry={entry}
      onSimulatePreviewPanel={onSimulatePreviewPanel}
      isPreviewPanelSimulated={isPreviewPanelSimulated}
    />
  )
}

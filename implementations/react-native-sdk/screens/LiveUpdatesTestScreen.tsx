import React, { useEffect, useState } from 'react'
import { Button, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  LiveUpdatesProvider,
  OptimizationScrollProvider,
  OptimizedEntry,
  useLiveUpdates,
  useOptimization,
} from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

import { LiveUpdatesEntryDisplay } from '../components/LiveUpdatesEntryDisplay'
import { ENV_CONFIG } from '../env.config'
import { fetchEntries } from '../utils/sdkHelpers'

interface LiveUpdatesTestScreenProps {
  onClose: () => void
}

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
      <View>
        <View>
          <Button
            testID="simulate-preview-panel-button"
            title={isPreviewPanelSimulated ? 'Close Preview Panel' : 'Simulate Preview Panel'}
            onPress={onSimulatePreviewPanel}
          />
        </View>
        <View>
          <View>
            <Text>Preview Panel:</Text>
            <Text testID="preview-panel-status">
              {liveUpdatesContext?.previewPanelVisible ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>
      </View>

      <OptimizationScrollProvider testID="live-updates-scroll-view">
        <View>
          <Text>Default Behavior (inherits global setting)</Text>
          <Text>No liveUpdates prop - inherits from OptimizationRoot (false)</Text>
          <OptimizedEntry entry={entry} testID="default-personalization">
            {(resolvedEntry) => (
              <LiveUpdatesEntryDisplay entry={resolvedEntry} testIdPrefix="default" />
            )}
          </OptimizedEntry>
        </View>

        <View>
          <Text>Live Updates Enabled (liveUpdates=true)</Text>
          <Text>Always updates when personalization state changes</Text>
          <OptimizedEntry entry={entry} liveUpdates={true} testID="live-personalization">
            {(resolvedEntry) => (
              <LiveUpdatesEntryDisplay entry={resolvedEntry} testIdPrefix="live" />
            )}
          </OptimizedEntry>
        </View>

        <View>
          <Text>Locked (liveUpdates=false)</Text>
          <Text>Never updates - locks to first variant received</Text>
          <OptimizedEntry entry={entry} liveUpdates={false} testID="locked-personalization">
            {(resolvedEntry) => (
              <LiveUpdatesEntryDisplay entry={resolvedEntry} testIdPrefix="locked" />
            )}
          </OptimizedEntry>
        </View>
      </OptimizationScrollProvider>
    </>
  )
}

export function LiveUpdatesTestScreen({ onClose }: LiveUpdatesTestScreenProps): React.JSX.Element {
  const sdk = useOptimization()
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
          if (entries.length > 0 && entries[0] !== undefined) {
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
    void sdk.identify({ userId: 'charles', traits: { identified: true } })
    setIsIdentified(true)
  }

  const handleReset = (): void => {
    sdk.reset()
    void sdk.page({ properties: { url: 'live-updates-test' } })
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
      <SafeAreaView>
        <Text>{error}</Text>
        <Button testID="close-live-updates-test-button" title="Close" onPress={onClose} />
      </SafeAreaView>
    )
  }

  if (isLoading || !entry) {
    return (
      <SafeAreaView>
        <Text>Loading...</Text>
      </SafeAreaView>
    )
  }

  return (
    <LiveUpdatesProvider
      globalLiveUpdates={globalLiveUpdates}
      key={`${globalLiveUpdates}-${isPreviewPanelSimulated}`}
    >
      <SafeAreaView>
        <View>
          <Text>Live Updates Test Controls</Text>
          <View>
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
          <View>
            <View>
              <Text>Identified:</Text>
              <Text testID="identified-status">{isIdentified ? 'Yes' : 'No'}</Text>
            </View>
            <View>
              <Text>Global Live Updates:</Text>
              <Text testID="global-live-updates-status">{globalLiveUpdates ? 'ON' : 'OFF'}</Text>
            </View>
          </View>
        </View>

        <ContentSectionsWithPreviewSimulation
          entry={entry}
          isPreviewPanelSimulated={isPreviewPanelSimulated}
          onSimulatePreviewPanel={handleSimulatePreviewPanel}
        />
      </SafeAreaView>
    </LiveUpdatesProvider>
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

import type { SelectedPersonalizationArray } from '@contentful/optimization-api-schemas'
import type { Entry } from 'contentful'
import { useEffect, useState, type ReactElement } from 'react'
import { OptimizedEntry } from '../../src'
import { EntryPanel } from '../components/EntryPanel'
import type { DatasetSnapshot } from '../types'
import { readTrackingDataset, toJsonPreview } from '../utils'

interface PersonalizationSectionProps {
  baselineDefault?: Entry
  baselineLive?: Entry
  baselineLocked?: Entry
  baselineNestedParent?: Entry
  baselineNestedChild?: Entry
  personalizations: SelectedPersonalizationArray | undefined
}

export function PersonalizationSection({
  baselineDefault,
  baselineLive,
  baselineLocked,
  baselineNestedParent,
  baselineNestedChild,
  personalizations,
}: PersonalizationSectionProps): ReactElement {
  const [datasetDefault, setDatasetDefault] = useState<DatasetSnapshot | null>(null)
  const [datasetLive, setDatasetLive] = useState<DatasetSnapshot | null>(null)
  const [datasetLocked, setDatasetLocked] = useState<DatasetSnapshot | null>(null)

  useEffect(() => {
    setDatasetDefault(readTrackingDataset('personalization-default'))
    setDatasetLive(readTrackingDataset('personalization-live'))
    setDatasetLocked(readTrackingDataset('personalization-locked'))
  }, [personalizations, baselineDefault, baselineLive, baselineLocked])

  return (
    <>
      <section className="dashboard__grid">
        {baselineDefault ? (
          <OptimizedEntry
            baselineEntry={baselineDefault}
            data-testid="personalization-default"
            loadingFallback={() => (
              <article className="dashboard__card">
                <h2>Personalization (inherits root liveUpdates)</h2>
                <p>Loading personalized content...</p>
              </article>
            )}
          >
            {(resolvedEntry: Entry) => (
              <EntryPanel
                title="Personalization (inherits root liveUpdates)"
                resolvedEntry={resolvedEntry}
              />
            )}
          </OptimizedEntry>
        ) : null}

        {baselineLive ? (
          <OptimizedEntry
            baselineEntry={baselineLive}
            liveUpdates={true}
            data-testid="personalization-live"
          >
            {(resolvedEntry: Entry) => (
              <EntryPanel
                title="Personalization (liveUpdates=true)"
                resolvedEntry={resolvedEntry}
              />
            )}
          </OptimizedEntry>
        ) : null}

        {baselineLocked ? (
          <OptimizedEntry
            baselineEntry={baselineLocked}
            liveUpdates={false}
            data-testid="personalization-locked"
          >
            {(resolvedEntry: Entry) => (
              <EntryPanel
                title="Personalization (liveUpdates=false)"
                resolvedEntry={resolvedEntry}
              />
            )}
          </OptimizedEntry>
        ) : null}
      </section>

      <section className="dashboard__grid">
        {baselineNestedParent && baselineNestedChild ? (
          <article className="dashboard__card">
            <h2>Nested Personalization</h2>
            <OptimizedEntry baselineEntry={baselineNestedParent} data-testid="nested-parent">
              {(parentResolved: Entry) => (
                <>
                  <p>{`Parent resolved ID: ${parentResolved.sys.id}`}</p>
                  <OptimizedEntry baselineEntry={baselineNestedChild} data-testid="nested-child">
                    {(childResolved: Entry) => (
                      <p>{`Child resolved ID: ${childResolved.sys.id}`}</p>
                    )}
                  </OptimizedEntry>
                </>
              )}
            </OptimizedEntry>
          </article>
        ) : null}

        <article className="dashboard__card">
          <h2>Tracking Attributes</h2>
          <pre className="dashboard__pre">
            {toJsonPreview({
              inherited: datasetDefault,
              liveTrue: datasetLive,
              liveFalse: datasetLocked,
            })}
          </pre>
        </article>
      </section>
    </>
  )
}

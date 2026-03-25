import type { SelectedOptimizationArray } from '@contentful/optimization-api-schemas'
import type { Entry } from 'contentful'
import { useEffect, useState, type ReactElement } from 'react'
import { OptimizedEntry } from '../../src'
import { EntryPanel } from '../components/EntryPanel'
import type { DatasetSnapshot } from '../types'
import { readTrackingDataset, toJsonPreview } from '../utils'

interface OptimizationSectionProps {
  baselineDefault?: Entry
  baselineLive?: Entry
  baselineLocked?: Entry
  baselineNestedParent?: Entry
  baselineNestedChild?: Entry
  selectedOptimizations: SelectedOptimizationArray | undefined
}

export function OptimizationSection({
  baselineDefault,
  baselineLive,
  baselineLocked,
  baselineNestedParent,
  baselineNestedChild,
  selectedOptimizations,
}: OptimizationSectionProps): ReactElement {
  const [datasetDefault, setDatasetDefault] = useState<DatasetSnapshot | null>(null)
  const [datasetLive, setDatasetLive] = useState<DatasetSnapshot | null>(null)
  const [datasetLocked, setDatasetLocked] = useState<DatasetSnapshot | null>(null)

  useEffect(() => {
    setDatasetDefault(readTrackingDataset('optimized-entry-default'))
    setDatasetLive(readTrackingDataset('optimized-entry-live'))
    setDatasetLocked(readTrackingDataset('optimized-entry-locked'))
  }, [selectedOptimizations, baselineDefault, baselineLive, baselineLocked])

  return (
    <>
      <section className="dashboard__grid">
        {baselineDefault ? (
          <OptimizedEntry
            baselineEntry={baselineDefault}
            data-testid="optimized-entry-default"
            loadingFallback={() => (
              <article className="dashboard__card">
                <h2>OptimizedEntry (inherits root liveUpdates)</h2>
                <p>Loading optimized content...</p>
              </article>
            )}
          >
            {(resolvedEntry: Entry) => (
              <EntryPanel
                title="OptimizedEntry (inherits root liveUpdates)"
                resolvedEntry={resolvedEntry}
              />
            )}
          </OptimizedEntry>
        ) : null}

        {baselineLive ? (
          <OptimizedEntry
            baselineEntry={baselineLive}
            liveUpdates={true}
            data-testid="optimized-entry-live"
          >
            {(resolvedEntry: Entry) => (
              <EntryPanel title="OptimizedEntry (liveUpdates=true)" resolvedEntry={resolvedEntry} />
            )}
          </OptimizedEntry>
        ) : null}

        {baselineLocked ? (
          <OptimizedEntry
            baselineEntry={baselineLocked}
            liveUpdates={false}
            data-testid="optimized-entry-locked"
          >
            {(resolvedEntry: Entry) => (
              <EntryPanel
                title="OptimizedEntry (liveUpdates=false)"
                resolvedEntry={resolvedEntry}
              />
            )}
          </OptimizedEntry>
        ) : null}
      </section>

      <section className="dashboard__grid">
        {baselineNestedParent && baselineNestedChild ? (
          <article className="dashboard__card">
            <h2>Nested OptimizedEntry</h2>
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

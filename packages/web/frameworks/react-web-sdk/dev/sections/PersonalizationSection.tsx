import type { SelectedPersonalizationArray } from '@contentful/optimization-api-schemas'
import type { Entry } from 'contentful'
import { useEffect, useState, type ReactElement } from 'react'
import { Personalization } from '../../src'
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
          <Personalization
            baselineEntry={baselineDefault}
            data-testid="personalization-default"
            loadingFallback={({ baselineEntry }) => (
              <article className="dashboard__card">
                <h2>Personalization (inherits root liveUpdates)</h2>
                <p>{`Loading ${baselineEntry.sys.id}...`}</p>
              </article>
            )}
          >
            {(resolvedEntry) => (
              <EntryPanel
                title="Personalization (inherits root liveUpdates)"
                resolvedEntry={resolvedEntry}
              />
            )}
          </Personalization>
        ) : null}

        {baselineLive ? (
          <Personalization
            baselineEntry={baselineLive}
            liveUpdates={true}
            data-testid="personalization-live"
          >
            {(resolvedEntry) => (
              <EntryPanel
                title="Personalization (liveUpdates=true)"
                resolvedEntry={resolvedEntry}
              />
            )}
          </Personalization>
        ) : null}

        {baselineLocked ? (
          <Personalization
            baselineEntry={baselineLocked}
            liveUpdates={false}
            data-testid="personalization-locked"
          >
            {(resolvedEntry) => (
              <EntryPanel
                title="Personalization (liveUpdates=false)"
                resolvedEntry={resolvedEntry}
              />
            )}
          </Personalization>
        ) : null}
      </section>

      <section className="dashboard__grid">
        {baselineNestedParent && baselineNestedChild ? (
          <article className="dashboard__card">
            <h2>Nested Personalization</h2>
            <Personalization baselineEntry={baselineNestedParent} data-testid="nested-parent">
              {(parentResolved) => (
                <>
                  <p>{`Parent resolved ID: ${parentResolved.sys.id}`}</p>
                  <Personalization baselineEntry={baselineNestedChild} data-testid="nested-child">
                    {(childResolved) => <p>{`Child resolved ID: ${childResolved.sys.id}`}</p>}
                  </Personalization>
                </>
              )}
            </Personalization>
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

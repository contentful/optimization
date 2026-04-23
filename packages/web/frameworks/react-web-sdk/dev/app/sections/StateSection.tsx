import type { Profile, SelectedOptimizationArray } from '@contentful/optimization-api-schemas'
import type { Entry } from 'contentful'
import type { ReactElement } from 'react'
import { ENTRY_IDS } from '../constants'
import type { ResolveResult } from '../types'
import { toJsonPreview } from '../utils'

interface StateSectionProps {
  globalLiveUpdates: boolean
  previewPanelVisible: boolean
  previewPanelOpen: boolean
  selectedOptimizations: SelectedOptimizationArray | undefined
  profile: Profile | undefined
  entriesLoadedCount: number
  entriesLoading: boolean
  entriesError: string | null
  resolveResults: ResolveResult[]
  onResolveEntries: () => void
  resolveEntryResult: Entry | undefined
  resolveEntryDataResult: unknown
  onResolveEntry: () => void
  onResolveEntryData: () => void
}

export function StateSection({
  globalLiveUpdates,
  previewPanelVisible,
  previewPanelOpen,
  selectedOptimizations,
  profile,
  entriesLoadedCount,
  entriesLoading,
  entriesError,
  resolveResults,
  onResolveEntries,
  resolveEntryResult,
  resolveEntryDataResult,
  onResolveEntry,
  onResolveEntryData,
}: StateSectionProps): ReactElement {
  const selectedOptimizationCount = Array.isArray(selectedOptimizations)
    ? selectedOptimizations.length
    : 0

  return (
    <section className="dashboard__grid">
      <article className="dashboard__card">
        <h2>State Inspectors</h2>
        <p>{`Global liveUpdates: ${globalLiveUpdates ? 'ON' : 'OFF'}`}</p>
        <p>{`Preview panel (context): ${previewPanelVisible ? 'Open' : 'Closed'}`}</p>
        <p>{`Preview panel (state): ${previewPanelOpen ? 'Open' : 'Closed'}`}</p>
        <p>{`Selected optimizations: ${selectedOptimizationCount}`}</p>
        <pre className="dashboard__pre">{toJsonPreview(profile)}</pre>
      </article>

      <article className="dashboard__card">
        <h2>Entry Resolver</h2>
        <p>Runs `optimization.resolveOptimizedEntry` for all baseline entries loaded below.</p>
        <button onClick={onResolveEntries} type="button">
          Resolve Entries
        </button>
        <pre className="dashboard__pre">{toJsonPreview(resolveResults)}</pre>
      </article>

      <article className="dashboard__card">
        <h2>Entry Loading</h2>
        <p>{`Loaded: ${entriesLoadedCount}/${ENTRY_IDS.length}`}</p>
        <p>{entriesLoading ? 'Loading...' : 'Ready'}</p>
        <p>{entriesError ? `Error: ${entriesError}` : 'No errors'}</p>
      </article>

      <article className="dashboard__card">
        <h2>resolveEntry()</h2>
        <p>Convenience method returning the resolved Entry directly.</p>
        <button onClick={onResolveEntry} type="button">
          resolveEntry()
        </button>
        <pre className="dashboard__pre">
          {resolveEntryResult ? resolveEntryResult.sys.id : 'Not resolved yet.'}
        </pre>
      </article>

      <article className="dashboard__card">
        <h2>resolveEntryData()</h2>
        <p>Convenience method returning the full ResolvedData object.</p>
        <button onClick={onResolveEntryData} type="button">
          resolveEntryData()
        </button>
        <pre className="dashboard__pre">{toJsonPreview(resolveEntryDataResult ?? null)}</pre>
      </article>
    </section>
  )
}

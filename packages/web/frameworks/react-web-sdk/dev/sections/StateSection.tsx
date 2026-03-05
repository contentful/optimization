import type { ReactElement } from 'react'
import { ENTRY_IDS } from '../constants'
import type { ResolveResult } from '../types'
import { toJsonPreview } from '../utils'

interface StateSectionProps {
  globalLiveUpdates: boolean
  previewPanelVisible: boolean
  previewPanelOpen: boolean
  personalizations: unknown
  profile: unknown
  entriesLoadedCount: number
  entriesLoading: boolean
  entriesError: string | null
  resolveResults: ResolveResult[]
  onResolveEntries: () => void
}

export function StateSection({
  globalLiveUpdates,
  previewPanelVisible,
  previewPanelOpen,
  personalizations,
  profile,
  entriesLoadedCount,
  entriesLoading,
  entriesError,
  resolveResults,
  onResolveEntries,
}: StateSectionProps): ReactElement {
  const personalizationCount = Array.isArray(personalizations) ? personalizations.length : 0

  return (
    <section className="dashboard__grid">
      <article className="dashboard__card">
        <h2>State Inspectors</h2>
        <p>{`Global liveUpdates: ${globalLiveUpdates ? 'ON' : 'OFF'}`}</p>
        <p>{`Preview panel (context): ${previewPanelVisible ? 'Open' : 'Closed'}`}</p>
        <p>{`Preview panel (state): ${previewPanelOpen ? 'Open' : 'Closed'}`}</p>
        <p>{`Personalizations selected: ${personalizationCount}`}</p>
        <pre className="dashboard__pre">{toJsonPreview(profile)}</pre>
      </article>

      <article className="dashboard__card">
        <h2>Entry Resolver</h2>
        <p>Runs `optimization.personalizeEntry` for all baseline entries loaded below.</p>
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
    </section>
  )
}

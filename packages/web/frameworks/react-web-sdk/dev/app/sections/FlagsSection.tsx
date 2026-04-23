import type { MergeTagEntry } from '@contentful/optimization-api-schemas'
import type { ReactElement } from 'react'
import type { UseOptimizationResult } from '../../../src/hooks/useOptimization'
import { toJsonPreview } from '../utils'

type FlagValue = ReturnType<UseOptimizationResult['getFlag']>

interface FlagsSectionProps {
  flags: Record<string, FlagValue> | undefined
  mergeTagValue: string | undefined
  mergeTagEntry: MergeTagEntry | undefined
  onGetFlags: () => void
  onGetMergeTagValue: () => void
}

export function FlagsSection({
  flags,
  mergeTagValue,
  mergeTagEntry,
  onGetFlags,
  onGetMergeTagValue,
}: FlagsSectionProps): ReactElement {
  return (
    <section className="dashboard__grid">
      <article className="dashboard__card">
        <h2>Feature Flags</h2>
        <p>Calls getFlag() for each mock flag key. Identify a user first to see resolved values.</p>
        <div className="dashboard__actions">
          <button onClick={onGetFlags} type="button">
            Get Flags
          </button>
        </div>
        <pre className="dashboard__pre">{flags ? toJsonPreview(flags) : 'Not fetched yet.'}</pre>
      </article>

      <article className="dashboard__card">
        <h2>Merge Tag Value</h2>
        <p>
          Resolves getMergeTagValue() using an nt_mergetag entry from the loaded merge tag content
          entry.
        </p>
        <div className="dashboard__actions">
          <button onClick={onGetMergeTagValue} type="button" disabled={!mergeTagEntry}>
            {mergeTagEntry ? 'Resolve Merge Tag' : 'No merge tag entry loaded'}
          </button>
        </div>
        <pre className="dashboard__pre">
          {mergeTagValue ?? (mergeTagEntry ? 'Not resolved yet.' : 'Waiting for entries...')}
        </pre>
      </article>
    </section>
  )
}

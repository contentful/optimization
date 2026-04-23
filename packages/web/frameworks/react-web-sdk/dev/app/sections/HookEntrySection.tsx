import type { Entry } from 'contentful'
import type { ReactElement } from 'react'
import { useOptimizedEntry } from '../../../src'
import { getFieldText, toJsonPreview } from '../utils'

interface HookEntrySectionProps {
  baselineEntry: Entry | undefined
}

function HookEntryCard({ baselineEntry }: { baselineEntry: Entry }): ReactElement {
  const { entry, isLoading, isReady, canOptimize, selectedOptimization } = useOptimizedEntry({
    baselineEntry,
  })

  if (isLoading || !isReady) {
    return (
      <article className="dashboard__card">
        <h2>useOptimizedEntry (hook only)</h2>
        <p>Resolving...</p>
      </article>
    )
  }

  return (
    <article className="dashboard__card">
      <h2>useOptimizedEntry (hook only)</h2>
      <p>Custom rendering without the OptimizedEntry wrapper component.</p>
      <p>
        <strong>Entry ID:</strong> {entry.sys.id}
      </p>
      <p>{getFieldText(entry.fields.internalTitle) || 'No internalTitle field'}</p>
      <p>
        <strong>canOptimize:</strong> {String(canOptimize)}
      </p>
      <pre className="dashboard__pre">{toJsonPreview(selectedOptimization ?? null)}</pre>
    </article>
  )
}

export function HookEntrySection({ baselineEntry }: HookEntrySectionProps): ReactElement {
  if (!baselineEntry) {
    return (
      <section className="dashboard__grid">
        <article className="dashboard__card">
          <h2>useOptimizedEntry (hook only)</h2>
          <p>No baseline entry available.</p>
        </article>
      </section>
    )
  }

  return (
    <section className="dashboard__grid">
      <HookEntryCard baselineEntry={baselineEntry} />
    </section>
  )
}

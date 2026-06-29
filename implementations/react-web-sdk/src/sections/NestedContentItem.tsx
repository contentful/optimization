import { OptimizedEntry } from '@contentful/optimization-react-web'
import { isResolvedContentfulEntry } from '@contentful/optimization-react-web/api-schemas'
import type { JSX } from 'react'
import type { ContentEntry, ContentEntrySkeleton } from '../types/contentful'

interface NestedContentItemProps {
  entry: ContentEntry
}

function renderText(entry: ContentEntry): string {
  return typeof entry.fields.text === 'string' ? entry.fields.text : ''
}

export function NestedContentItem({ entry }: NestedContentItemProps): JSX.Element {
  return (
    <OptimizedEntry baselineEntry={entry} hoverDurationUpdateIntervalMs={1000}>
      {(resolvedEntry) => {
        const asCf = resolvedEntry as ContentEntry
        const nestedEntries = Array.isArray(asCf.fields.nested)
          ? asCf.fields.nested.filter(isResolvedContentfulEntry<ContentEntrySkeleton>)
          : []
        const text = renderText(asCf)
        const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

        return (
          <div className="entry-card">
            <div data-testid={`entry-text-${resolvedEntry.sys.id}`} aria-label={fullLabel}>
              <p>{text}</p>
              <p>{`[Entry: ${resolvedEntry.sys.id}]`}</p>
            </div>

            {nestedEntries.length > 0 ? (
              <div className="entry-card__nested-children">
                {nestedEntries.map((nestedEntry) => (
                  <NestedContentItem key={nestedEntry.sys.id} entry={nestedEntry} />
                ))}
              </div>
            ) : null}
          </div>
        )
      }}
    </OptimizedEntry>
  )
}

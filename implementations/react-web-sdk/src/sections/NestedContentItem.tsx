import { OptimizedEntry } from '@contentful/optimization-react-web'
import type { JSX } from 'react'
import type { ContentEntry } from '../types/contentful'
import { isRecord } from '../utils/typeGuards'

interface NestedContentItemProps {
  entry: ContentEntry
}

function isEntry(value: unknown): value is ContentEntry {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    typeof value.sys.id === 'string' &&
    isRecord(value.fields)
  )
}

function renderText(entry: ContentEntry): string {
  return typeof entry.fields.text === 'string' ? entry.fields.text : ''
}

export function NestedContentItem({ entry }: NestedContentItemProps): JSX.Element {
  return (
    <OptimizedEntry baselineEntry={entry} hoverDurationUpdateIntervalMs={1000}>
      {(resolvedEntry) => {
        const asCf = resolvedEntry as ContentEntry
        const nestedEntries = Array.isArray(asCf.fields.nested) ? asCf.fields.nested : []
        const text = renderText(asCf)
        const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

        return (
          <div className="entry-card">
            <div data-testid={`entry-text-${resolvedEntry.sys.id}`} aria-label={fullLabel}>
              <p>{text}</p>
              <p>{`[Entry: ${resolvedEntry.sys.id}]`}</p>
            </div>

            {nestedEntries.filter(isEntry).length > 0 ? (
              <div className="nested-children">
                {nestedEntries.filter(isEntry).map((nestedEntry) => (
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

import { OptimizedEntry } from '@contentful/optimization-react-web'
import type { JSX } from 'react'
import type { ContentfulEntry } from '../types/contentful'
import { isRecord } from '../utils/typeGuards'

interface NestedContentItemProps {
  entry: ContentfulEntry
}

function isEntry(value: unknown): value is ContentfulEntry {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    typeof value.sys.id === 'string' &&
    isRecord(value.fields)
  )
}

function renderText(entry: ContentfulEntry): string {
  return typeof entry.fields.text === 'string' ? entry.fields.text : ''
}

export function NestedContentItem({ entry }: NestedContentItemProps): JSX.Element {
  return (
    <OptimizedEntry baselineEntry={entry}>
      {(resolvedEntry) => {
        const asCf = resolvedEntry as ContentfulEntry
        const nestedEntries = Array.isArray(asCf.fields.nested) ? asCf.fields.nested : []
        const text = renderText(asCf)
        const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

        return (
          <div data-ctfl-hover-duration-update-interval-ms="1000">
            <div data-testid={`entry-text-${resolvedEntry.sys.id}`} aria-label={fullLabel}>
              <p>{text}</p>
              <p>{`[Entry: ${resolvedEntry.sys.id}]`}</p>
            </div>

            {nestedEntries.filter(isEntry).map((nestedEntry) => (
              <NestedContentItem key={nestedEntry.sys.id} entry={nestedEntry} />
            ))}
          </div>
        )
      }}
    </OptimizedEntry>
  )
}

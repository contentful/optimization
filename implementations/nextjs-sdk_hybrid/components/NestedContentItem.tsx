import type { ContentEntry } from '@/lib/contentful'
import { isRecord } from '@/lib/util'
import { OptimizedEntry } from '@contentful/optimization-nextjs/client'
import type { JSX } from 'react'

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
          <div>
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

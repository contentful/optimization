import { type JSX, useEffect, useMemo } from 'react'
import { useAnalytics } from '../optimization/hooks/useAnalytics'
import { usePersonalization } from '../optimization/hooks/usePersonalization'
import type { ContentfulEntry } from '../types/contentful'

interface NestedContentItemProps {
  entry: ContentfulEntry
}

function isEntry(value: unknown): value is ContentfulEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sys' in value &&
    typeof value.sys === 'object' &&
    value.sys !== null &&
    'id' in value.sys
  )
}

function renderText(contentEntry: ContentfulEntry): string {
  return typeof contentEntry.fields.text === 'string' ? contentEntry.fields.text : ''
}

export function NestedContentItem({ entry }: NestedContentItemProps): JSX.Element {
  const { resolveEntry } = usePersonalization()
  const { trackView } = useAnalytics()

  const { entry: resolvedEntry } = useMemo(() => resolveEntry(entry), [entry, resolveEntry])

  useEffect(() => {
    void trackView({ componentId: resolvedEntry.sys.id })
  }, [resolvedEntry, trackView])

  const nestedEntries = Array.isArray(resolvedEntry.fields.nested)
    ? resolvedEntry.fields.nested
    : []

  const text = renderText(resolvedEntry)
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
}

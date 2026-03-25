import { useMemo, type JSX } from 'react'
import { useOptimizationResolver } from '../optimization/hooks/useOptimizationResolver'
import type { ContentfulEntry } from '../types/contentful'
import { isRecord } from '../utils/typeGuards'

interface NestedContentItemProps {
  entry: ContentfulEntry
}

interface SelectedOptimizationMeta {
  experienceId?: string
  sticky?: boolean
  variantIndex?: number
}

function isEntry(value: unknown): value is ContentfulEntry {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    typeof value.sys.id === 'string' &&
    isRecord(value.fields)
  )
}

function getSelectedOptimizationMeta(value: unknown): SelectedOptimizationMeta {
  if (!isRecord(value)) {
    return {}
  }

  return {
    experienceId: typeof value.experienceId === 'string' ? value.experienceId : undefined,
    sticky: typeof value.sticky === 'boolean' ? value.sticky : undefined,
    variantIndex: typeof value.variantIndex === 'number' ? value.variantIndex : undefined,
  }
}

function renderText(contentEntry: ContentfulEntry): string {
  return typeof contentEntry.fields.text === 'string' ? contentEntry.fields.text : ''
}

export function NestedContentItem({ entry }: NestedContentItemProps): JSX.Element {
  const { resolveEntry } = useOptimizationResolver()
  const resolved = useMemo(() => resolveEntry(entry), [entry, resolveEntry])
  const { entry: resolvedEntry, selectedOptimization } = resolved

  const { experienceId, sticky, variantIndex } = useMemo(
    () => getSelectedOptimizationMeta(selectedOptimization),
    [selectedOptimization],
  )

  const nestedEntries = Array.isArray(resolvedEntry.fields.nested)
    ? resolvedEntry.fields.nested
    : []

  const text = renderText(resolvedEntry)
  const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

  return (
    <div
      data-ctfl-entry-id={resolvedEntry.sys.id}
      data-ctfl-baseline-id={entry.sys.id}
      data-ctfl-optimization-id={experienceId}
      data-ctfl-sticky={sticky === undefined ? undefined : String(sticky)}
      data-ctfl-variant-index={variantIndex === undefined ? undefined : String(variantIndex)}
    >
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

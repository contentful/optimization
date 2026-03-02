import { type JSX, useEffect, useMemo, useRef } from 'react'
import { RichTextRenderer } from '../components/RichTextRenderer'
import { useOptimization } from '../optimization/hooks/useOptimization'
import { usePersonalization } from '../optimization/hooks/usePersonalization'
import type { ContentfulEntry, RichTextDocument } from '../types/contentful'
import { isRecord } from '../utils/typeGuards'

interface ContentEntryProps {
  entry: ContentfulEntry
  observation: 'auto' | 'manual'
}

interface PersonalizationMeta {
  experienceId?: string
  sticky?: boolean
  variantIndex?: number
}

interface EntryViewElementOptions {
  readonly dwellTimeMs?: number
  readonly data?: {
    readonly entryId: string
    readonly personalizationId?: string
    readonly sticky?: boolean
    readonly variantIndex?: number
  }
}

interface TrackingApi {
  enableElement: (interaction: 'views', element: Element, options?: EntryViewElementOptions) => void
  clearElement: (interaction: 'views', element: Element) => void
}

interface TrackingApiOwner {
  tracking: TrackingApi
}

function hasTrackingApi(value: unknown): value is TrackingApiOwner {
  if (!isRecord(value)) return false

  const { tracking } = value
  if (!isRecord(tracking)) return false

  return typeof tracking.enableElement === 'function' && typeof tracking.clearElement === 'function'
}

function isRichTextField(field: unknown): field is RichTextDocument {
  return (
    typeof field === 'object' &&
    field !== null &&
    'nodeType' in field &&
    (field as { nodeType: unknown }).nodeType === 'document' &&
    'content' in field &&
    Array.isArray((field as { content: unknown }).content)
  )
}

function getPersonalizationMeta(value: unknown): PersonalizationMeta {
  if (!isRecord(value)) {
    return {}
  }

  const experienceId = typeof value.experienceId === 'string' ? value.experienceId : undefined
  const sticky = typeof value.sticky === 'boolean' ? value.sticky : undefined
  const variantIndex = typeof value.variantIndex === 'number' ? value.variantIndex : undefined

  return { experienceId, sticky, variantIndex }
}

function getEntryText(contentEntry: ContentfulEntry): string {
  return typeof contentEntry.fields.text === 'string' ? contentEntry.fields.text : 'No content'
}

export function ContentEntry({ entry, observation }: ContentEntryProps): JSX.Element {
  const { sdk, isReady } = useOptimization()
  const { resolveEntry } = usePersonalization()
  const containerRef = useRef<HTMLDivElement | null>(null)

  const resolved = useMemo(() => resolveEntry(entry), [entry, resolveEntry])
  const { entry: resolvedEntry, personalization } = resolved

  const { experienceId, sticky, variantIndex } = useMemo(
    () => getPersonalizationMeta(personalization),
    [personalization],
  )

  useEffect(() => {
    if (!isReady || sdk === undefined || observation !== 'manual' || !hasTrackingApi(sdk)) {
      return
    }

    const { current: element } = containerRef
    if (!element) {
      return
    }

    const options: EntryViewElementOptions = {
      data: {
        entryId: resolvedEntry.sys.id,
        personalizationId: experienceId,
        sticky,
        variantIndex,
      },
    }

    sdk.tracking.enableElement('views', element, options)

    return () => {
      sdk.tracking.clearElement('views', element)
    }
  }, [experienceId, isReady, observation, resolvedEntry.sys.id, sdk, sticky, variantIndex])

  const richTextField = Object.values(resolvedEntry.fields).find(isRichTextField)

  const fullLabel = `Entry: ${resolvedEntry.sys.id}`

  const autoTrackingAttributes =
    observation === 'auto'
      ? {
          'data-ctfl-entry-id': resolvedEntry.sys.id,
          'data-ctfl-baseline-id': entry.sys.id,
          'data-ctfl-personalization-id': experienceId,
          'data-ctfl-sticky': sticky === undefined ? undefined : String(sticky),
          'data-ctfl-variant-index': variantIndex === undefined ? undefined : String(variantIndex),
        }
      : undefined

  const manualTrackingAttributes =
    observation === 'manual'
      ? {
          'data-entry-id': entry.sys.id,
        }
      : undefined

  return (
    <section data-testid={`content-entry-${entry.sys.id}`}>
      <div
        ref={containerRef}
        {...autoTrackingAttributes}
        {...manualTrackingAttributes}
        data-testid={`content-${entry.sys.id}`}
      >
        <div data-testid={`entry-text-${entry.sys.id}`} aria-label={fullLabel}>
          {richTextField ? (
            <RichTextRenderer richText={richTextField} />
          ) : (
            <p>{getEntryText(resolvedEntry)}</p>
          )}
          <p>{`[Entry: ${entry.sys.id}]`}</p>
        </div>
      </div>
    </section>
  )
}

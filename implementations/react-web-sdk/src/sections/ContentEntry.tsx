import { OptimizedEntry, useOptimization } from '@contentful/optimization-react-web'
import { type JSX, type RefObject, useEffect, useRef } from 'react'
import { RichTextRenderer } from '../components/RichTextRenderer'
import type { ContentfulEntry, RichTextDocument } from '../types/contentful'

export type EntryClickScenario = 'direct' | 'descendant' | 'ancestor'

interface ContentEntryProps {
  clickScenario?: EntryClickScenario
  entry: ContentfulEntry
  observation: 'auto' | 'manual'
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

function getEntryText(entry: ContentfulEntry): string {
  return typeof entry.fields.text === 'string' ? entry.fields.text : 'No content'
}

interface ManuallyTrackedContentProps {
  baselineEntry: ContentfulEntry
  containerRef: RefObject<HTMLDivElement | null>
}

function ManuallyTrackedContent({
  baselineEntry,
  containerRef,
}: ManuallyTrackedContentProps): JSX.Element {
  const { interactionTracking, resolveEntry } = useOptimization()
  const resolvedEntry = resolveEntry(baselineEntry)
  const richTextField = Object.values(resolvedEntry.fields).find(isRichTextField)
  const fullLabel = `Entry: ${resolvedEntry.sys.id}`
  const resolvedId = resolvedEntry.sys.id

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    interactionTracking.enableElement('views', element, { data: { entryId: resolvedId } })

    return () => {
      interactionTracking.clearElement('views', element)
    }
  }, [containerRef, interactionTracking, resolvedId])

  return (
    <div
      ref={containerRef}
      data-entry-id={baselineEntry.sys.id}
      data-testid={`content-${baselineEntry.sys.id}`}
    >
      <div data-testid={`entry-text-${baselineEntry.sys.id}`} aria-label={fullLabel}>
        {richTextField ? (
          <RichTextRenderer richText={richTextField} />
        ) : (
          <p>{getEntryText(resolvedEntry)}</p>
        )}
        <p>{`[Entry: ${baselineEntry.sys.id}]`}</p>
      </div>
    </div>
  )
}

interface AutoTrackedContentProps {
  baselineEntry: ContentfulEntry
  clickScenario: EntryClickScenario | undefined
}

function AutoTrackedContent({
  baselineEntry,
  clickScenario,
}: AutoTrackedContentProps): JSX.Element {
  return (
    <OptimizedEntry baselineEntry={baselineEntry}>
      {(resolvedEntry) => {
        const richTextField = Object.values(resolvedEntry.fields).find(isRichTextField)
        const fullLabel = `Entry: ${resolvedEntry.sys.id}`
        const asCf = resolvedEntry as ContentfulEntry

        const directClickAttrs =
          clickScenario === 'direct' ? ({ 'data-ctfl-clickable': 'true' } as const) : undefined

        const content = (
          <div
            data-ctfl-hover-duration-update-interval-ms="1000"
            data-testid={`content-${baselineEntry.sys.id}`}
            {...directClickAttrs}
          >
            <div data-testid={`entry-text-${baselineEntry.sys.id}`} aria-label={fullLabel}>
              {richTextField ? (
                <RichTextRenderer richText={richTextField as RichTextDocument} />
              ) : (
                <p>{getEntryText(asCf)}</p>
              )}
              <p>{`[Entry: ${baselineEntry.sys.id}]`}</p>
            </div>

            {clickScenario === 'descendant' ? (
              <button data-testid="entry-click-descendant-button" type="button">
                Trigger entry click tracking from descendant button
              </button>
            ) : null}
          </div>
        )

        if (clickScenario === 'ancestor') {
          return (
            <div data-ctfl-clickable="true" data-testid="entry-click-ancestor-wrapper">
              {content}
            </div>
          )
        }

        return content
      }}
    </OptimizedEntry>
  )
}

export function ContentEntry({
  clickScenario,
  entry,
  observation,
}: ContentEntryProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)

  if (observation === 'auto') {
    return (
      <section data-testid={`content-entry-${entry.sys.id}`}>
        <AutoTrackedContent baselineEntry={entry} clickScenario={clickScenario} />
      </section>
    )
  }

  return (
    <section data-testid={`content-entry-${entry.sys.id}`}>
      <ManuallyTrackedContent baselineEntry={entry} containerRef={containerRef} />
    </section>
  )
}

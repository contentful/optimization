import { useOptimization } from '@contentful/optimization-react-web'
import type { JSX, RefObject } from 'react'
import { useEffect, useRef } from 'react'
import { RichTextRenderer } from '../components/RichTextRenderer'
import type { ContentfulEntry, RichTextDocument } from '../types/contentful'

export type EntryClickScenario = 'direct' | 'descendant' | 'ancestor'

interface ContentEntryProps {
  clickScenario?: EntryClickScenario
  entry: ContentfulEntry
  observation: 'auto' | 'manual'
}

interface ResolvedOptimizationMeta {
  experienceId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
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

function resolveOptimizationMeta(selectedOptimization: unknown): ResolvedOptimizationMeta {
  if (typeof selectedOptimization !== 'object' || selectedOptimization === null) {
    return { experienceId: undefined, sticky: undefined, variantIndex: undefined }
  }

  const { experienceId, sticky, variantIndex } = selectedOptimization as {
    experienceId?: unknown
    sticky?: unknown
    variantIndex?: unknown
  }

  return {
    experienceId: typeof experienceId === 'string' ? experienceId : undefined,
    sticky: typeof sticky === 'boolean' ? sticky : undefined,
    variantIndex: typeof variantIndex === 'number' ? variantIndex : undefined,
  }
}

interface ContentDivProps {
  baselineEntry: ContentfulEntry
  clickScenario: EntryClickScenario | undefined
  containerRef: RefObject<HTMLDivElement | null>
  meta: ResolvedOptimizationMeta
  observation: 'auto' | 'manual'
  resolvedEntry: ContentfulEntry
}

function ContentDiv({
  baselineEntry,
  clickScenario,
  containerRef,
  meta,
  observation,
  resolvedEntry,
}: ContentDivProps): JSX.Element {
  const richTextField = Object.values(resolvedEntry.fields).find(isRichTextField)
  const fullLabel = `Entry: ${resolvedEntry.sys.id}`
  const { experienceId, sticky, variantIndex } = meta

  const autoAttrs =
    observation === 'auto'
      ? {
          'data-ctfl-entry-id': resolvedEntry.sys.id,
          'data-ctfl-baseline-id': baselineEntry.sys.id,
          'data-ctfl-optimization-id': experienceId,
          'data-ctfl-sticky': sticky === undefined ? undefined : String(sticky),
          'data-ctfl-variant-index': variantIndex === undefined ? undefined : String(variantIndex),
          'data-ctfl-hover-duration-update-interval-ms': '1000',
        }
      : { 'data-entry-id': baselineEntry.sys.id }

  const directClickAttrs =
    clickScenario === 'direct' ? ({ 'data-ctfl-clickable': 'true' } as const) : undefined

  return (
    <div
      ref={containerRef}
      data-testid={`content-${baselineEntry.sys.id}`}
      {...autoAttrs}
      {...directClickAttrs}
    >
      <div data-testid={`entry-text-${baselineEntry.sys.id}`} aria-label={fullLabel}>
        {richTextField ? (
          <RichTextRenderer richText={richTextField} />
        ) : (
          <p>{getEntryText(resolvedEntry)}</p>
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
}

interface TrackedContentProps {
  baselineEntry: ContentfulEntry
  clickScenario: EntryClickScenario | undefined
  containerRef: RefObject<HTMLDivElement | null>
  observation: 'auto' | 'manual'
}

function TrackedContent({
  baselineEntry,
  clickScenario,
  containerRef,
  observation,
}: TrackedContentProps): JSX.Element {
  const { interactionTracking, resolveEntry, resolveEntryData } = useOptimization()
  const resolvedEntry = resolveEntry(baselineEntry) as ContentfulEntry
  const { selectedOptimization } = resolveEntryData(baselineEntry)
  const meta = resolveOptimizationMeta(selectedOptimization)

  useEffect(() => {
    if (observation !== 'manual') {
      return undefined
    }

    const { current: element } = containerRef
    if (!element) {
      return undefined
    }

    interactionTracking.enableElement('views', element, {
      data: {
        entryId: resolvedEntry.sys.id,
        optimizationId: meta.experienceId,
        sticky: meta.sticky,
        variantIndex: meta.variantIndex,
      },
    })

    return () => {
      interactionTracking.clearElement('views', element)
    }
  }, [
    containerRef,
    interactionTracking,
    meta.experienceId,
    meta.sticky,
    meta.variantIndex,
    observation,
    resolvedEntry.sys.id,
  ])

  const content = (
    <ContentDiv
      baselineEntry={baselineEntry}
      clickScenario={clickScenario}
      containerRef={containerRef}
      meta={meta}
      observation={observation}
      resolvedEntry={resolvedEntry}
    />
  )

  if (clickScenario === 'ancestor' && observation === 'auto') {
    return (
      <div data-ctfl-clickable="true" data-testid="entry-click-ancestor-wrapper">
        {content}
      </div>
    )
  }

  return content
}

export function ContentEntry({
  clickScenario,
  entry,
  observation,
}: ContentEntryProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)

  return (
    <section data-testid={`content-entry-${entry.sys.id}`}>
      <TrackedContent
        baselineEntry={entry}
        clickScenario={clickScenario}
        containerRef={containerRef}
        observation={observation}
      />
    </section>
  )
}

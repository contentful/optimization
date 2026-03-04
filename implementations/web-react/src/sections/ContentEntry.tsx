import { type JSX, type RefObject, useEffect, useMemo, useRef } from 'react'
import { RichTextRenderer } from '../components/RichTextRenderer'
import { useOptimization } from '../optimization/hooks/useOptimization'
import { usePersonalization } from '../optimization/hooks/usePersonalization'
import type { ContentfulEntry, RichTextDocument } from '../types/contentful'
import { isRecord } from '../utils/typeGuards'

interface ContentEntryProps {
  clickScenario?: EntryClickScenario
  entry: ContentfulEntry
  observation: 'auto' | 'manual'
}

export type EntryClickScenario = 'direct' | 'descendant' | 'ancestor'

type ObservationMode = ContentEntryProps['observation']

interface AutoTrackingAttributes {
  'data-ctfl-entry-id': string
  'data-ctfl-baseline-id': string
  'data-ctfl-hover-duration-update-interval-ms': string
  'data-ctfl-personalization-id': string | undefined
  'data-ctfl-sticky': string | undefined
  'data-ctfl-variant-index': string | undefined
}

interface ManualTrackingAttributes {
  'data-entry-id': string
}

interface TrackingAttributes {
  autoTrackingAttributes: AutoTrackingAttributes | undefined
  manualTrackingAttributes: ManualTrackingAttributes | undefined
}

interface GetTrackingAttributesInput {
  baselineEntryId: string
  experienceId: string | undefined
  observation: ObservationMode
  resolvedEntryId: string
  sticky: boolean | undefined
  variantIndex: number | undefined
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

function getTrackingAttributes(input: GetTrackingAttributesInput): TrackingAttributes {
  const { baselineEntryId, experienceId, observation, resolvedEntryId, sticky, variantIndex } =
    input

  if (observation === 'auto') {
    return {
      autoTrackingAttributes: {
        'data-ctfl-entry-id': resolvedEntryId,
        'data-ctfl-baseline-id': baselineEntryId,
        'data-ctfl-personalization-id': experienceId,
        'data-ctfl-sticky': sticky === undefined ? undefined : String(sticky),
        'data-ctfl-variant-index': variantIndex === undefined ? undefined : String(variantIndex),
        'data-ctfl-hover-duration-update-interval-ms': '1000',
      },
      manualTrackingAttributes: undefined,
    }
  }

  return {
    autoTrackingAttributes: undefined,
    manualTrackingAttributes: {
      'data-entry-id': baselineEntryId,
    },
  }
}

const DIRECT_CLICK_SCENARIO_ATTRIBUTES = {
  'data-ctfl-clickable': 'true',
} as const

interface RenderContentContainerProps {
  autoTrackingAttributes: AutoTrackingAttributes | undefined
  baselineEntryId: string
  clickScenario: EntryClickScenario | undefined
  containerRef: RefObject<HTMLDivElement | null>
  fullLabel: string
  manualTrackingAttributes: ManualTrackingAttributes | undefined
  resolvedEntry: ContentfulEntry
  richTextField: RichTextDocument | undefined
}

function renderContentContainer({
  autoTrackingAttributes,
  baselineEntryId,
  clickScenario,
  containerRef,
  fullLabel,
  manualTrackingAttributes,
  resolvedEntry,
  richTextField,
}: RenderContentContainerProps): JSX.Element {
  const directClickScenarioAttributes =
    clickScenario === 'direct' ? DIRECT_CLICK_SCENARIO_ATTRIBUTES : undefined

  return (
    <div
      ref={containerRef}
      {...autoTrackingAttributes}
      {...manualTrackingAttributes}
      {...directClickScenarioAttributes}
      data-testid={`content-${baselineEntryId}`}
    >
      <div data-testid={`entry-text-${baselineEntryId}`} aria-label={fullLabel}>
        {richTextField ? (
          <RichTextRenderer richText={richTextField} />
        ) : (
          <p>{getEntryText(resolvedEntry)}</p>
        )}
        <p>{`[Entry: ${baselineEntryId}]`}</p>
      </div>

      {clickScenario === 'descendant' ? (
        <button data-testid="entry-click-descendant-button" type="button">
          Trigger entry click tracking from descendant button
        </button>
      ) : null}
    </div>
  )
}

function wrapAncestorClickScenario(
  content: JSX.Element,
  clickScenario: EntryClickScenario | undefined,
  observation: ObservationMode,
): JSX.Element {
  if (clickScenario !== 'ancestor' || observation !== 'auto') {
    return content
  }

  return (
    <div data-ctfl-clickable="true" data-testid="entry-click-ancestor-wrapper">
      {content}
    </div>
  )
}

export function ContentEntry({
  clickScenario,
  entry,
  observation,
}: ContentEntryProps): JSX.Element {
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

  const { autoTrackingAttributes, manualTrackingAttributes } = getTrackingAttributes({
    baselineEntryId: entry.sys.id,
    experienceId,
    observation,
    resolvedEntryId: resolvedEntry.sys.id,
    sticky,
    variantIndex,
  })
  const content = renderContentContainer({
    autoTrackingAttributes,
    baselineEntryId: entry.sys.id,
    clickScenario,
    containerRef,
    fullLabel,
    manualTrackingAttributes,
    resolvedEntry,
    richTextField,
  })

  return (
    <section data-testid={`content-entry-${entry.sys.id}`}>
      {wrapAncestorClickScenario(content, clickScenario, observation)}
    </section>
  )
}

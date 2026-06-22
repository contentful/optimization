import { OptimizedEntry, useOptimization } from '@contentful/optimization-react-web'
import type { JSX } from 'react'
import { useEffect, useRef } from 'react'
import { RichTextRenderer } from '../components/RichTextRenderer'
import type { ContentEntry as ContentEntryType, RichTextDocument } from '../types/contentful'

export type EntryClickScenario = 'direct' | 'descendant' | 'ancestor'
type ViewTrackingMode = 'auto' | 'manual'

interface ContentEntryProps {
  clickScenario?: EntryClickScenario
  entry: ContentEntryType
  viewTracking: ViewTrackingMode
}

const HOVER_DURATION_UPDATE_INTERVAL_MS = 1000

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

function getEntryText(entry: ContentEntryType): string {
  return typeof entry.fields.text === 'string' ? entry.fields.text : 'No content'
}

export function ContentEntry({
  clickScenario,
  entry,
  viewTracking,
}: ContentEntryProps): JSX.Element {
  const sdk = useOptimization()
  const manuallyTrackedElement = useRef<HTMLDivElement | null>(null)
  const autoTrackViews = viewTracking === 'auto'

  useEffect(
    () => () => {
      const { current } = manuallyTrackedElement
      if (!current) {
        return
      }

      sdk.tracking.clearElement('views', current)
    },
    [sdk.tracking],
  )

  const updateManualViewElement = (element: HTMLDivElement | null, entryId: string): void => {
    const { current: previousElement } = manuallyTrackedElement

    if (previousElement && previousElement !== element) {
      sdk.tracking.clearElement('views', previousElement)
    }

    manuallyTrackedElement.current = element

    if (!element || viewTracking !== 'manual') {
      return
    }

    sdk.tracking.enableElement('views', element, {
      data: { entryId },
    })
  }

  return (
    <section data-testid={`content-entry-${entry.sys.id}`}>
      <OptimizedEntry
        baselineEntry={entry}
        clickable={autoTrackViews && clickScenario === 'direct'}
        hoverDurationUpdateIntervalMs={
          autoTrackViews ? HOVER_DURATION_UPDATE_INTERVAL_MS : undefined
        }
        trackViews={autoTrackViews ? undefined : false}
      >
        {(resolvedEntry) => {
          const asCf = resolvedEntry as ContentEntryType
          const richTextField = Object.values(asCf.fields).find(isRichTextField)
          const fullLabel = `Entry: ${asCf.sys.id}`

          const content = (
            <div
              ref={
                viewTracking === 'manual'
                  ? (element) => {
                      updateManualViewElement(element, asCf.sys.id)
                    }
                  : undefined
              }
              data-ctfl-entry-id={asCf.sys.id}
              data-testid={`content-${entry.sys.id}`}
            >
              <div data-testid={`entry-text-${entry.sys.id}`} aria-label={fullLabel}>
                {richTextField ? (
                  <RichTextRenderer richText={richTextField} />
                ) : (
                  <p>{getEntryText(asCf)}</p>
                )}
                <p>{`[Entry: ${entry.sys.id}]`}</p>
              </div>

              {clickScenario === 'descendant' ? (
                <button data-testid="entry-click-descendant-button" type="button">
                  Trigger entry click tracking from descendant button
                </button>
              ) : null}
            </div>
          )

          if (autoTrackViews && clickScenario === 'ancestor') {
            return (
              <div data-ctfl-clickable="true" data-testid="entry-click-ancestor-wrapper">
                {content}
              </div>
            )
          }

          return content
        }}
      </OptimizedEntry>
    </section>
  )
}

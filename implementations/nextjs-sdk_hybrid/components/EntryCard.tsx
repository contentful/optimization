'use client'

import type { ContentEntry as ContentEntryType, RichTextDocument } from '@/lib/contentful'
import { useManualViewTracking } from '@/lib/hooks'
import { isRecord } from '@/lib/util'
import {
  OptimizedEntry,
  isMergeTagEntry,
  useMergeTagResolver,
} from '@contentful/optimization-nextjs/client'
import { documentToReactComponents, type Options } from '@contentful/rich-text-react-renderer'
import { INLINES } from '@contentful/rich-text-types'
import type { EntryClickScenario } from 'e2e-web'
import type { JSX } from 'react'

export type ViewTrackingMode = 'auto' | 'manual'

export interface EntryCardProps {
  clickScenario?: EntryClickScenario
  entry: ContentEntryType
  liveUpdates?: boolean
  testId?: string
  viewTracking?: ViewTrackingMode
}

const HOVER_DURATION_UPDATE_INTERVAL_MS = 1000

function isRichTextField(field: unknown): field is RichTextDocument {
  return isRecord(field) && field.nodeType === 'document' && Array.isArray(field.content)
}

function isEntry(value: unknown): value is ContentEntryType {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    typeof value.sys.id === 'string' &&
    isRecord(value.fields)
  )
}

type GetMergeTagValue = ReturnType<typeof useMergeTagResolver>['getMergeTagValue']

function isLink(target: unknown): target is { sys: { type: 'Link' } } {
  return isRecord(target) && isRecord(target.sys) && target.sys.type === 'Link'
}

function getMergeTagText(target: unknown, getMergeTagValue: GetMergeTagValue): string {
  if (isLink(target) || !isMergeTagEntry(target)) return '[Merge Tag]'
  return getMergeTagValue(target) ?? ''
}

function RichText({ richText }: { readonly richText: RichTextDocument }): JSX.Element {
  const { getMergeTagValue } = useMergeTagResolver()

  const renderOptions: Options = {
    renderNode: {
      [INLINES.EMBEDDED_ENTRY]: (node): string => {
        const { data } = node
        if (!isRecord(data) || !('target' in data)) return '[Merge Tag]'
        return getMergeTagText(data.target, getMergeTagValue)
      },
    },
  }

  return <>{documentToReactComponents(richText, renderOptions)}</>
}

export function EntryCard({
  clickScenario,
  entry,
  liveUpdates,
  testId,
  viewTracking,
}: EntryCardProps): JSX.Element {
  const updateManualViewElement = useManualViewTracking(viewTracking)
  const autoTrackViews = viewTracking === 'auto'

  if (!viewTracking) {
    const id = testId ?? entry.sys.id
    return (
      <OptimizedEntry
        baselineEntry={entry}
        hoverDurationUpdateIntervalMs={HOVER_DURATION_UPDATE_INTERVAL_MS}
        liveUpdates={liveUpdates}
      >
        {(resolvedEntry) => {
          const asCf = resolvedEntry as ContentEntryType
          const text = typeof asCf.fields.text === 'string' ? asCf.fields.text : ''
          const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`
          const nestedEntries = Array.isArray(asCf.fields.nested) ? asCf.fields.nested : []

          return (
            <div
              className="entry-card"
              data-test-entry-id={resolvedEntry.sys.id}
              data-testid={`content-${id}`}
            >
              <div aria-label={fullLabel} data-testid={`entry-text-${id}`}>
                <p>{text}</p>
                <p>{`[Entry: ${resolvedEntry.sys.id}]`}</p>
              </div>
              {nestedEntries.filter(isEntry).length > 0 ? (
                <div className="entry-card__nested-children">
                  {nestedEntries.filter(isEntry).map((nestedEntry) => (
                    <EntryCard entry={nestedEntry} key={nestedEntry.sys.id} />
                  ))}
                </div>
              ) : null}
            </div>
          )
        }}
      </OptimizedEntry>
    )
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
          const entryLabel = `Entry: ${asCf.sys.id}`

          const content = (
            <div
              ref={
                viewTracking === 'manual'
                  ? (element) => {
                      updateManualViewElement(element, asCf.sys.id)
                    }
                  : undefined
              }
              className="entry-card"
              data-ctfl-entry-id={asCf.sys.id}
              data-testid={`content-${entry.sys.id}`}
            >
              <div
                aria-label={entryLabel}
                className={richTextField ? 'rich-text' : undefined}
                data-testid={`entry-text-${entry.sys.id}`}
              >
                {richTextField ? (
                  <RichText richText={richTextField} />
                ) : (
                  <p>{typeof asCf.fields.text === 'string' ? asCf.fields.text : 'No content'}</p>
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

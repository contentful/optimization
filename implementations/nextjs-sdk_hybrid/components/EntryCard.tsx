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

export interface EntryCardProps {
  clickScenario?: EntryClickScenario
  entry: ContentEntryType
  liveUpdates?: boolean
  manualTracking?: boolean
  testId?: string
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

function useRichTextRenderer(): Options {
  const { getMergeTagValue } = useMergeTagResolver()
  return {
    renderNode: {
      [INLINES.EMBEDDED_ENTRY]: (node): string => {
        const { data } = node
        if (!isRecord(data) || !('target' in data)) return '[Merge Tag]'
        const { target } = data
        if (
          (isRecord(target) && isRecord(target.sys) && target.sys.type === 'Link') ||
          !isMergeTagEntry(target)
        )
          return '[Merge Tag]'
        return getMergeTagValue(target) ?? ''
      },
    },
  }
}

export function EntryCard({
  clickScenario,
  entry,
  liveUpdates,
  manualTracking,
  testId,
}: EntryCardProps): JSX.Element {
  const updateManualViewElement = useManualViewTracking(manualTracking)
  const renderOptions = useRichTextRenderer()
  const autoTracking = !manualTracking
  const id = testId ?? entry.sys.id

  return (
    <section data-testid={`content-entry-${id}`}>
      <OptimizedEntry
        baselineEntry={entry}
        clickable={autoTracking && clickScenario === 'direct'}
        hoverDurationUpdateIntervalMs={autoTracking ? HOVER_DURATION_UPDATE_INTERVAL_MS : undefined}
        liveUpdates={liveUpdates}
        trackViews={autoTracking ? undefined : false}
      >
        {(resolvedEntry) => {
          const asCf = resolvedEntry as ContentEntryType
          const richTextField = Object.values(asCf.fields).find(isRichTextField)
          const nestedEntries = Array.isArray(asCf.fields.nested) ? asCf.fields.nested : []
          const nested = nestedEntries.filter(isEntry)

          const content = (
            <div
              ref={
                manualTracking
                  ? (element) => {
                      updateManualViewElement(element, asCf.sys.id)
                    }
                  : undefined
              }
              className="entry-card"
              data-ctfl-entry-id={asCf.sys.id}
              data-testid={`content-${id}`}
            >
              <div
                aria-label={`Entry: ${asCf.sys.id}`}
                className={richTextField ? 'rich-text' : undefined}
                data-testid={`entry-text-${id}`}
              >
                {richTextField ? (
                  <>{documentToReactComponents(richTextField, renderOptions)}</>
                ) : (
                  <p>{typeof asCf.fields.text === 'string' ? asCf.fields.text : 'No content'}</p>
                )}
                <p>{`[Entry: ${asCf.sys.id}]`}</p>
              </div>

              {clickScenario === 'descendant' ? (
                <button data-testid="entry-click-descendant-button" type="button">
                  Trigger entry click tracking from descendant button
                </button>
              ) : null}

              {nested.length > 0 ? (
                <div className="entry-card__nested-children">
                  {nested.map((nestedEntry) => (
                    <EntryCard entry={nestedEntry} key={nestedEntry.sys.id} />
                  ))}
                </div>
              ) : null}
            </div>
          )

          if (autoTracking && clickScenario === 'ancestor') {
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

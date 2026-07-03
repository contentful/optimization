'use client'

import type { ContentEntry, ContentEntrySkeleton } from '@/lib/contentful'
import {
  isRecord,
  isResolvedContentfulEntry,
  isRichTextDocument,
} from '@contentful/optimization-nextjs/api-schemas'
import { OptimizedEntry, useMergeTagResolver } from '@contentful/optimization-nextjs/client'
import { documentToReactComponents, type Options } from '@contentful/rich-text-react-renderer'
import { INLINES } from '@contentful/rich-text-types'
import type { EntryClickScenario } from 'e2e-web'
import type { JSX } from 'react'

const HOVER_DURATION_UPDATE_INTERVAL_MS = 1000

type MergeTagResolver = (entry: unknown) => string | undefined

interface EntryCardProps {
  baselineEntry: ContentEntry
  clickScenario?: EntryClickScenario
  manualTracking: boolean
}

function buildRenderOptions(getMergeTagValue: MergeTagResolver): Options {
  return {
    renderNode: {
      [INLINES.EMBEDDED_ENTRY]: (node): string => {
        const { data } = node
        if (!isRecord(data) || !('target' in data)) return ''
        return getMergeTagValue(data.target) ?? ''
      },
    },
  }
}

function EntryContent({
  baselineEntry,
  clickScenario,
  resolvedEntry,
}: {
  baselineEntry: ContentEntry
  clickScenario?: EntryClickScenario
  resolvedEntry: ContentEntry
}): JSX.Element {
  const { getMergeTagValue } = useMergeTagResolver()
  const richText = Object.values(resolvedEntry.fields).find(isRichTextDocument)
  const nested = Array.isArray(resolvedEntry.fields.nested)
    ? resolvedEntry.fields.nested.filter(isResolvedContentfulEntry<ContentEntrySkeleton>)
    : []
  const renderOptions = buildRenderOptions((entry) => getMergeTagValue(entry as never))

  return (
    <div data-ctfl-entry-id={resolvedEntry.sys.id} data-testid={`content-${baselineEntry.sys.id}`}>
      <div
        aria-label={`Entry: ${baselineEntry.sys.id}`}
        className={richText ? 'rich-text' : undefined}
        data-testid={`entry-text-${baselineEntry.sys.id}`}
      >
        {richText ? (
          <>{documentToReactComponents(richText, renderOptions)}</>
        ) : (
          <p>{typeof resolvedEntry.fields.text === 'string' ? resolvedEntry.fields.text : ''}</p>
        )}
        <p>{`[Entry: ${baselineEntry.sys.id}]`}</p>
      </div>
      {clickScenario === 'descendant' ? (
        <button data-testid="entry-click-descendant-button" type="button">
          Trigger entry click tracking from descendant button
        </button>
      ) : null}
      {nested.length > 0 ? (
        <div className="entry-card__nested-children">
          {nested.map((nestedEntry) => (
            <EntryCard
              baselineEntry={nestedEntry}
              key={nestedEntry.sys.id}
              manualTracking={false}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function EntryCard({
  baselineEntry,
  clickScenario,
  manualTracking,
}: EntryCardProps): JSX.Element {
  const autoTrackViews = !manualTracking

  return (
    <section className="entry-card" data-testid={`content-entry-${baselineEntry.sys.id}`}>
      <OptimizedEntry
        as="div"
        baselineEntry={baselineEntry}
        clickable={autoTrackViews && clickScenario === 'direct'}
        hoverDurationUpdateIntervalMs={
          autoTrackViews ? HOVER_DURATION_UPDATE_INTERVAL_MS : undefined
        }
        trackViews={autoTrackViews ? undefined : false}
      >
        {(resolvedEntry) =>
          autoTrackViews && clickScenario === 'ancestor' ? (
            <div data-ctfl-clickable="true" data-testid="entry-click-ancestor-wrapper">
              <EntryContent
                baselineEntry={baselineEntry}
                clickScenario={clickScenario}
                resolvedEntry={resolvedEntry as ContentEntry}
              />
            </div>
          ) : (
            <EntryContent
              baselineEntry={baselineEntry}
              clickScenario={clickScenario}
              resolvedEntry={resolvedEntry as ContentEntry}
            />
          )
        }
      </OptimizedEntry>
    </section>
  )
}

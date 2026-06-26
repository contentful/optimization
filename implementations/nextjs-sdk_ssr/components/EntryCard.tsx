import type { ContentEntry, RichTextDocument } from '@/lib/contentful'
import { isRecord } from '@/lib/util'
import {
  ServerOptimizedEntry,
  type ServerTrackingResolvedData,
} from '@contentful/optimization-nextjs/server'
import { documentToReactComponents, type Options } from '@contentful/rich-text-react-renderer'
import { INLINES } from '@contentful/rich-text-types'
import type { EntryClickScenario } from 'e2e-web'
import type { JSX } from 'react'

const HOVER_DURATION_UPDATE_INTERVAL_MS = 1000

type MergeTagResolver = (entry: unknown) => string | undefined

interface EntryCardProps {
  baselineEntry: ContentEntry
  clickScenario?: EntryClickScenario
  getMergeTagValue?: MergeTagResolver
  manualTracking: boolean
  resolveEntry?: (entry: ContentEntry) => ServerTrackingResolvedData
  resolvedData: ServerTrackingResolvedData
}

function isRichTextField(field: unknown): field is RichTextDocument {
  return isRecord(field) && field.nodeType === 'document' && Array.isArray(field.content)
}

function isEntry(value: unknown): value is ContentEntry {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    typeof value.sys.id === 'string' &&
    isRecord(value.fields)
  )
}

function buildRenderOptions(getMergeTagValue?: MergeTagResolver): Options {
  return {
    renderNode: {
      [INLINES.EMBEDDED_ENTRY]: (node): string => {
        const { data } = node
        if (!isRecord(data) || !('target' in data)) return ''
        return getMergeTagValue?.(data.target) ?? ''
      },
    },
  }
}

export function EntryCard({
  baselineEntry,
  clickScenario,
  getMergeTagValue,
  manualTracking,
  resolveEntry,
  resolvedData,
}: EntryCardProps): JSX.Element {
  const resolvedEntry = resolvedData.entry as ContentEntry
  const autoTrackViews = !manualTracking
  const richText = Object.values(resolvedEntry.fields).find(isRichTextField)
  const nested = Array.isArray(resolvedEntry.fields.nested)
    ? resolvedEntry.fields.nested.filter(isEntry)
    : []
  const renderOptions = buildRenderOptions(getMergeTagValue)

  const content = (
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
              getMergeTagValue={getMergeTagValue}
              key={nestedEntry.sys.id}
              manualTracking={false}
              resolveEntry={resolveEntry}
              resolvedData={resolveEntry ? resolveEntry(nestedEntry) : { entry: nestedEntry }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )

  return (
    <section className="entry-card" data-testid={`content-entry-${baselineEntry.sys.id}`}>
      <ServerOptimizedEntry
        as="div"
        baselineEntry={baselineEntry}
        clickable={autoTrackViews && clickScenario === 'direct'}
        hoverDurationUpdateIntervalMs={
          autoTrackViews ? HOVER_DURATION_UPDATE_INTERVAL_MS : undefined
        }
        resolvedData={resolvedData}
        trackViews={autoTrackViews ? undefined : false}
      >
        {autoTrackViews && clickScenario === 'ancestor' ? (
          <div data-ctfl-clickable="true" data-testid="entry-click-ancestor-wrapper">
            {content}
          </div>
        ) : (
          content
        )}
      </ServerOptimizedEntry>
    </section>
  )
}

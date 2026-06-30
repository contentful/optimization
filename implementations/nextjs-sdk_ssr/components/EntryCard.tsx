import { EntryCardClient } from '@/components/EntryCard.client'
import type { ContentEntry, RichTextDocument } from '@/lib/contentful'
import type { PageEntry } from '@/lib/resolution'
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

interface EntryCardServerProps {
  baselineEntry: ContentEntry
  clickScenario?: EntryClickScenario
  manualTracking: boolean
  resolvedData: ServerTrackingResolvedData
  resolvedEntry: PageEntry['resolvedEntry']
  entry?: never
  liveUpdates?: never
  testId?: never
}

interface EntryCardClientProps {
  entry: ContentEntry
  liveUpdates?: boolean
  testId: string
  baselineEntry?: never
  clickScenario?: never
  manualTracking?: never
  resolvedData?: never
  resolvedEntry?: never
}

type EntryCardProps = EntryCardServerProps | EntryCardClientProps

function isRichTextField(field: unknown): field is RichTextDocument {
  return isRecord(field) && field.nodeType === 'document' && Array.isArray(field.content)
}

const RENDER_OPTIONS: Options = {
  renderNode: {
    [INLINES.EMBEDDED_ENTRY]: (node): string => {
      const { data } = node
      if (!isRecord(data)) return ''
      return typeof data.resolvedValue === 'string' ? data.resolvedValue : ''
    },
  },
}

export function EntryCard(props: EntryCardProps): JSX.Element {
  if (props.entry !== undefined) {
    return (
      <section className="entry-card" data-testid={`content-entry-${props.testId}`}>
        <EntryCardClient
          entry={props.entry}
          liveUpdates={props.liveUpdates}
          testId={props.testId}
        />
      </section>
    )
  }

  const { baselineEntry, clickScenario, manualTracking, resolvedData, resolvedEntry } = props
  const autoTrackViews = !manualTracking
  const richText = Object.values(resolvedEntry.fields).find(isRichTextField)
  const nested: PageEntry[] = resolvedEntry.fields.nested ?? []

  const content = (
    <div data-ctfl-entry-id={resolvedEntry.sys.id} data-testid={`content-${baselineEntry.sys.id}`}>
      <div
        aria-label={`Entry: ${baselineEntry.sys.id}`}
        className={richText ? 'rich-text' : undefined}
        data-testid={`entry-text-${baselineEntry.sys.id}`}
      >
        {richText ? (
          <>{documentToReactComponents(richText, RENDER_OPTIONS)}</>
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
              key={nestedEntry.baselineEntry.sys.id}
              baselineEntry={nestedEntry.baselineEntry}
              manualTracking={false}
              resolvedData={nestedEntry.resolvedData}
              resolvedEntry={nestedEntry.resolvedEntry}
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

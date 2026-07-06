import type { ContentEntry, ContentEntrySkeleton } from '@/lib/contentful'
import {
  isMergeTagEntry,
  isRecord,
  isResolvedContentfulEntry,
  isRichTextDocument,
  isUnresolvedEntryLink,
  type MergeTagEntry,
} from '@contentful/optimization-nextjs/api-schemas'
import { documentToReactComponents, type Options } from '@contentful/rich-text-react-renderer'
import { INLINES } from '@contentful/rich-text-types'
import type { EntryClickScenario } from 'e2e-web'
import type { JSX, ReactNode } from 'react'

type MergeTagValueResolver = (entry: MergeTagEntry) => string | undefined

interface EntryCardContentProps {
  className?: string
  clickScenario?: EntryClickScenario
  clickableAncestor?: boolean
  emptyText?: string
  entry: ContentEntry
  labelEntryId?: string
  renderNestedEntry?: (entry: ContentEntry) => ReactNode
  renderOptions?: Options
  testId?: string
  textAriaLabel?: string
}

export function createRichTextRenderOptions(getMergeTagValue?: MergeTagValueResolver): Options {
  return {
    renderNode: {
      [INLINES.EMBEDDED_ENTRY]: (node): string => {
        const { data } = node
        if (!isRecord(data) || !('target' in data)) return '[Merge Tag]'
        const { target } = data
        if (isUnresolvedEntryLink(target) || !isMergeTagEntry(target)) return '[Merge Tag]'
        return getMergeTagValue?.(target) ?? ''
      },
    },
  }
}

export function EntryCardContent({
  className,
  clickScenario,
  clickableAncestor,
  emptyText = '',
  entry,
  labelEntryId = entry.sys.id,
  renderNestedEntry,
  renderOptions = createRichTextRenderOptions(),
  testId,
  textAriaLabel = `Entry: ${labelEntryId}`,
}: EntryCardContentProps): JSX.Element {
  const id = testId ?? entry.sys.id
  const richText = Object.values(entry.fields).find(isRichTextDocument)
  const nested = Array.isArray(entry.fields.nested)
    ? entry.fields.nested.filter(isResolvedContentfulEntry<ContentEntrySkeleton>)
    : []

  const content = (
    <div
      className={className}
      data-ctfl-entry-id={entry.sys.id}
      data-test-entry-id={entry.sys.id}
      data-testid={`content-${id}`}
    >
      <div
        aria-label={textAriaLabel}
        className={richText ? 'rich-text' : undefined}
        data-testid={`entry-text-${id}`}
      >
        {richText ? (
          <>{documentToReactComponents(richText, renderOptions)}</>
        ) : (
          <p>{typeof entry.fields.text === 'string' ? entry.fields.text : emptyText}</p>
        )}
        <p>{`[Entry: ${labelEntryId}]`}</p>
      </div>

      {clickScenario === 'descendant' ? (
        <button data-testid="entry-click-descendant-button" type="button">
          Trigger entry click tracking from descendant button
        </button>
      ) : null}

      {renderNestedEntry && nested.length > 0 ? (
        <div className="entry-card__nested-children">{nested.map(renderNestedEntry)}</div>
      ) : null}
    </div>
  )

  return clickableAncestor ? (
    <div data-ctfl-clickable="true" data-testid="entry-click-ancestor-wrapper">
      {content}
    </div>
  ) : (
    content
  )
}

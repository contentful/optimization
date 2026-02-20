import { type JSX, useEffect, useMemo } from 'react'
import { RichTextRenderer, getRichTextContent } from '../components/RichTextRenderer'
import { useAnalytics } from '../optimization/hooks/useAnalytics'
import { usePersonalization } from '../optimization/hooks/usePersonalization'
import type { ContentfulEntry, RichTextDocument } from '../types/contentful'

interface ContentEntryProps {
  entry: ContentfulEntry
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

function getEntryText(contentEntry: ContentfulEntry): string {
  const richTextField = Object.values(contentEntry.fields).find(isRichTextField)

  if (richTextField) {
    return ''
  }

  return typeof contentEntry.fields.text === 'string' ? contentEntry.fields.text : 'No content'
}

export function ContentEntry({ entry }: ContentEntryProps): JSX.Element {
  const { resolveEntry, getMergeTagValue } = usePersonalization()
  const { trackView } = useAnalytics()

  const { entry: resolvedEntry } = useMemo(() => resolveEntry(entry), [entry, resolveEntry])

  useEffect(() => {
    void trackView({ componentId: resolvedEntry.sys.id })
  }, [resolvedEntry, trackView])

  const richTextField = Object.values(resolvedEntry.fields).find(isRichTextField)

  const fullLabel = richTextField
    ? `${getRichTextContent(richTextField, getMergeTagValue)} [Entry: ${entry.sys.id}]`
    : `${getEntryText(resolvedEntry)} [Entry: ${entry.sys.id}]`

  return (
    <section data-testid={`content-entry-${entry.sys.id}`}>
      <div data-testid={`content-${entry.sys.id}`}>
        <div data-testid={`entry-text-${entry.sys.id}`} aria-label={fullLabel}>
          {richTextField ? <RichTextRenderer richText={richTextField} /> : <p>{getEntryText(resolvedEntry)}</p>}
          <p>{`[Entry: ${entry.sys.id}]`}</p>
        </div>
      </div>
    </section>
  )
}

import type { JSX } from 'react'
import { NestedContentItem } from './NestedContentItem'
import type { ContentfulEntry } from '../types/contentful'

interface NestedContentEntryProps {
  entry: ContentfulEntry
}

export function NestedContentEntry({ entry }: NestedContentEntryProps): JSX.Element {
  return (
    <section data-testid={`nested-content-entry-${entry.sys.id}`}>
      <NestedContentItem entry={entry} />
    </section>
  )
}

import type { JSX } from 'react'
import type { ContentEntry } from '../types/contentful'
import { NestedContentItem } from './NestedContentItem'

interface NestedContentEntryProps {
  entry: ContentEntry
}

export function NestedContentEntry({ entry }: NestedContentEntryProps): JSX.Element {
  return (
    <section data-testid={`nested-content-entry-${entry.sys.id}`}>
      <NestedContentItem entry={entry} />
    </section>
  )
}

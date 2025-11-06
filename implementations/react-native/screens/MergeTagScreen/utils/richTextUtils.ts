/**
 * Utility functions for processing Contentful rich text fields
 */

import type {
  EmbeddedEntryNode,
  RichTextField,
  RichTextNode,
  TextNode,
} from '../types'

export function findMergeTagEntries(
  fragment: RichTextField | RichTextNode,
  mergeTagEntries: EmbeddedEntryNode[] = [],
): EmbeddedEntryNode[] {
  if (!fragment.content) return mergeTagEntries

  const embeddedEntries = fragment.content.filter(
    (item): item is EmbeddedEntryNode =>
      item.nodeType.startsWith('embedded') &&
      'data' in item &&
      item.data?.target?.sys?.id !== undefined,
  )

  mergeTagEntries.push(...embeddedEntries)

  fragment.content
    .filter((item): item is RichTextNode => 'content' in item && Array.isArray(item.content))
    .forEach((item) => findMergeTagEntries(item, mergeTagEntries))

  return mergeTagEntries
}

export function isTextNode(item: unknown): item is TextNode {
  return (
    typeof item === 'object' &&
    item !== null &&
    'nodeType' in item &&
    'value' in item &&
    typeof (item as { value: unknown }).value === 'string'
  )
}

export function extractTextFromRichText(node: RichTextField | RichTextNode): string {
  if (!node.content) return ''

  return node.content
    .map((item) => {
      if (item.nodeType === 'text' && isTextNode(item)) {
        return item.value
      }
      if (item.nodeType.startsWith('embedded')) {
        return '[MERGE TAG]'
      }
      if ('content' in item) {
        return extractTextFromRichText(item)
      }
      return ''
    })
    .join('')
}


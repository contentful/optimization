import { isMergeTagEntry, type MergeTagEntry } from '@contentful/optimization-web/api-schemas'
import { INLINES, type Document, type Text } from '@contentful/rich-text-types'
import type { Entry } from 'contentful'
import { isRecord } from '../utils'

/**
 * Resolves the substitution value for a single merge-tag entry. Returning
 * `undefined` lets the walker fall back to `target.fields.nt_fallback`.
 */
export type MergeTagResolver = (target: MergeTagEntry) => string | undefined

function isRichTextDocument(value: unknown): value is Document {
  return isRecord(value) && value.nodeType === 'document'
}

function resolveNode(node: unknown, resolveMergeTag: MergeTagResolver): unknown {
  if (!isRecord(node)) return node
  const { data } = node
  if (node.nodeType === INLINES.EMBEDDED_ENTRY && isRecord(data)) {
    const { target } = data
    if (isMergeTagEntry(target)) {
      return {
        nodeType: 'text',
        value: resolveMergeTag(target) ?? '',
        marks: [],
        data: {},
      } satisfies Text
    }
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map((child) => resolveNode(child, resolveMergeTag)) }
  }
  return node
}

/**
 * Walk every rich-text field on the entry and substitute merge-tag inline
 * entries with text nodes produced by `resolveMergeTag`. Non-rich-text fields
 * pass through unchanged. Runtime-agnostic — used by both the browser-side
 * component layer and the SSR preflight.
 */
export function resolveEntryMergeTags(entry: Entry, resolveMergeTag: MergeTagResolver): Entry {
  return Object.assign({}, entry, {
    fields: Object.fromEntries(
      Object.entries(entry.fields).map(([key, value]) => [
        key,
        isRichTextDocument(value) ? resolveNode(value, resolveMergeTag) : value,
      ]),
    ),
  }) as Entry
}

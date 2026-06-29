import type {
  Document as RichTextDocument,
  Node as RichTextNode,
} from '@contentful/rich-text-types'
import type {
  ChainModifiers,
  Entry,
  EntrySkeletonType,
  LocaleCode,
  UnresolvedLink,
} from 'contentful'
import { AudienceEntryFields, type AudienceEntry } from './AudienceEntry'
import { MergeTagEntryFields, type MergeTagEntry } from './MergeTagEntry'
import {
  EntryReplacementVariant,
  type EntryReplacementComponent,
  type InlineVariableComponent,
  type OptimizationComponent,
} from './OptimizationConfig'
import { OptimizationEntryFields, type OptimizationEntry } from './OptimizationEntry'
import { OptimizedEntryFields, type OptimizedEntry } from './OptimizedEntry'

const RICH_TEXT_DOCUMENT_NODE_TYPE = 'document'

/**
 * Type guard that checks whether the given value is a non-array object record.
 *
 * @param value - The value to test.
 * @returns `true` when the value is an object, non-null, and not an array.
 *
 * @public
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @internal */
function getRecord(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined

  const { [key]: candidate } = value
  return isRecord(candidate) ? candidate : undefined
}

/** @internal */
function getString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined

  const { [key]: candidate } = value
  return typeof candidate === 'string' ? candidate : undefined
}

/** @internal */
function getContentTypeId(entry: Entry): string {
  return entry.sys.contentType.sys.id
}

/**
 * Type guard that checks whether the given value has the structural shape of a Contentful Rich Text
 * node.
 *
 * @param value - The value to test.
 * @returns `true` when the value has `nodeType` and object `data` fields, with array `content` when
 * present.
 *
 * @public
 */
export function isRichTextNode(value: unknown): value is RichTextNode {
  return (
    isRecord(value) &&
    typeof value.nodeType === 'string' &&
    isRecord(value.data) &&
    (value.content === undefined || Array.isArray(value.content))
  )
}

/**
 * Type guard that checks whether the given value has the structural shape of a Contentful Rich Text
 * document.
 *
 * @param value - The value to test.
 * @returns `true` when the value is a Rich Text document node with array content.
 *
 * @public
 */
export function isRichTextDocument(value: unknown): value is RichTextDocument {
  if (!isRichTextNode(value) || value.nodeType !== RICH_TEXT_DOCUMENT_NODE_TYPE) return false

  const content = isRecord(value) ? value.content : undefined
  return Array.isArray(content)
}

/**
 * Type guard that checks whether the given value is an unresolved Contentful entry link.
 *
 * @param value - The value to test.
 * @returns `true` when the value is an unresolved `Entry` link.
 *
 * @public
 */
export function isUnresolvedEntryLink(value: unknown): value is UnresolvedLink<'Entry'> {
  const sys = getRecord(value, 'sys')

  return (
    getString(sys, 'type') === 'Link' &&
    getString(sys, 'linkType') === 'Entry' &&
    getString(sys, 'id') !== undefined
  )
}

/**
 * Type guard that checks whether the given value is a resolved Contentful entry.
 *
 * @remarks
 * This distinguishes resolved entries from unresolved links. It intentionally
 * checks only the structural fields required by SDK resolution and does not
 * validate a consumer-provided entry skeleton.
 *
 * @param value - The value to test.
 * @returns `true` when the value has the resolved Contentful entry shape.
 *
 * @public
 */
export function isResolvedContentfulEntry<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(value: unknown): value is Entry<S, M, L> {
  const sys = getRecord(value, 'sys')
  const contentType = getRecord(sys, 'contentType')
  const contentTypeSys = getRecord(contentType, 'sys')

  return (
    getString(sys, 'type') === 'Entry' &&
    getString(sys, 'id') !== undefined &&
    getString(contentTypeSys, 'id') !== undefined &&
    isRecord(getRecord(value, 'metadata')) &&
    isRecord(getRecord(value, 'fields'))
  )
}

/**
 * Type guard for a resolved {@link AudienceEntry}.
 *
 * @param entry - Value to test.
 * @returns `true` if the value is a resolved `nt_audience` entry with valid Optimization fields.
 *
 * @public
 */
export function isResolvedAudienceEntry(entry: unknown): entry is AudienceEntry {
  return (
    isResolvedContentfulEntry(entry) &&
    getContentTypeId(entry) === 'nt_audience' &&
    AudienceEntryFields.safeParse(entry.fields).success
  )
}

/**
 * Type guard for {@link EntryReplacementVariant}.
 *
 * @param variant - Value to test.
 * @returns `true` if `variant` conforms to {@link EntryReplacementVariant}, otherwise `false`.
 *
 * @example
 * ```ts
 * if (isEntryReplacementVariant(variant)) {
 *   console.log(variant.id);
 * }
 * ```
 *
 * @public
 */
export function isEntryReplacementVariant(variant: unknown): variant is EntryReplacementVariant {
  return EntryReplacementVariant.safeParse(variant).success
}

/**
 * Type guard for {@link EntryReplacementComponent}.
 *
 * @param component - Personalization component to test.
 * @returns `true` if the component is an EntryReplacement component, otherwise `false`.
 *
 * @example
 * ```ts
 * if (isEntryReplacementComponent(component)) {
 *   console.log(component.baseline.id);
 * }
 * ```
 *
 * @public
 */
export function isEntryReplacementComponent(
  component: OptimizationComponent,
): component is EntryReplacementComponent {
  return component.type === 'EntryReplacement' || component.type === undefined
}

/**
 * Type guard for {@link InlineVariableComponent}.
 *
 * @param component - Personalization component to test.
 * @returns `true` if the component is an InlineVariable component, otherwise `false`.
 *
 * @example
 * ```ts
 * if (isInlineVariableComponent(component)) {
 *   console.log(component.key, component.valueType);
 * }
 * ```
 *
 * @public
 */
export function isInlineVariableComponent(
  component: OptimizationComponent,
): component is InlineVariableComponent {
  return component.type === 'InlineVariable'
}

/**
 * Type guard for a resolved {@link OptimizationEntry}.
 *
 * @param entry - Contentful entry or link to test.
 * @returns `true` if the value is a resolved optimization entry, otherwise `false`.
 *
 * @public
 */
export function isResolvedOptimizationEntry(entry: unknown): entry is OptimizationEntry {
  if (!isResolvedContentfulEntry(entry) || getContentTypeId(entry) !== 'nt_experience') {
    return false
  }

  const fieldsResult = OptimizationEntryFields.safeParse(entry.fields)

  if (!fieldsResult.success) return false

  const { data: fields } = fieldsResult
  const { nt_audience: audienceEntry, nt_variants: variants } = fields
  const audienceReferenceIsValid =
    audienceEntry === undefined ||
    audienceEntry === null ||
    isUnresolvedEntryLink(audienceEntry) ||
    isResolvedAudienceEntry(audienceEntry)
  const variantReferencesAreValid =
    variants === undefined ||
    variants.every(
      (variant) => isUnresolvedEntryLink(variant) || isResolvedContentfulEntry(variant),
    )

  return audienceReferenceIsValid && variantReferencesAreValid
}

/**
 * Type guard for a resolved {@link OptimizedEntry}.
 *
 * @param entry - Contentful entry to test.
 * @returns `true` if the entry is resolved and has Optimization experience references.
 *
 * @public
 */
export function isResolvedOptimizedEntry<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(entry: unknown): entry is OptimizedEntry<S, M, L> {
  if (!isResolvedContentfulEntry(entry)) return false

  const fieldsResult = OptimizedEntryFields.safeParse(entry.fields)

  if (!fieldsResult.success) return false

  return fieldsResult.data.nt_experiences.every(
    (optimizationEntry) =>
      isUnresolvedEntryLink(optimizationEntry) || isResolvedOptimizationEntry(optimizationEntry),
  )
}

/**
 * Type guard for {@link MergeTagEntry}.
 *
 * @param entry - Value to test.
 * @returns `true` if the value is a resolved Merge Tag entry, otherwise `false`.
 *
 * @public
 */
export function isMergeTagEntry(entry: unknown): entry is MergeTagEntry {
  return (
    isResolvedContentfulEntry(entry) &&
    getContentTypeId(entry) === 'nt_mergetag' &&
    MergeTagEntryFields.safeParse(entry.fields).success
  )
}

import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import { CtflEntry } from './CtflEntry'
import { MergeTagEntry } from './MergeTagEntry'
import {
  type EntryReplacementComponent,
  EntryReplacementVariant,
  type InlineVariableComponent,
  type PersonalizationComponent,
} from './PersonalizationConfig'
import { PersonalizationEntry } from './PersonalizationEntry'
import { PersonalizedEntry } from './PersonalizedEntry'

/**
 * Type guard that checks whether the given value is a Contentful {@link Entry},
 * passing through the specified skeleton, chain modifiers, and locale.
 *
 * @typeParam S - The entry skeleton type.
 * @typeParam M - The chain modifiers type. Defaults to {@link ChainModifiers}.
 * @typeParam L - The locale code type. Defaults to {@link LocaleCode}.
 *
 * @param entry - The value to test.
 * @returns `true` if the object conforms to {@link CtflEntry} and can be treated
 * as a typed {@link Entry}, otherwise `false`.
 *
 * @example
 * ```ts
 * const entry = await client.getEntry('my-entry-id');
 * if (isEntry<MySkeleton>(entry)) {
 *   console.log(entry.fields.myField);
 * }
 * ```
 *
 * @public
 */
export function isEntry<
  S extends EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(entry: unknown): entry is Entry<S, M, L> {
  return CtflEntry.safeParse(entry).success
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
  component: PersonalizationComponent,
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
  component: PersonalizationComponent,
): component is InlineVariableComponent {
  return component.type === 'InlineVariable'
}

/**
 * Type guard for {@link PersonalizationEntry}.
 *
 * @param entry - Contentful entry or link to test.
 * @returns `true` if the value conforms to {@link PersonalizationEntry}, otherwise `false`.
 *
 * @example
 * ```ts
 * if (isPersonalizationEntry(entry)) {
 *   console.log(entry.fields.nt_name);
 * }
 * ```
 *
 * @public
 */
export function isPersonalizationEntry(entry: unknown): entry is PersonalizationEntry {
  return PersonalizationEntry.safeParse(entry).success
}

/**
 * Type guard for {@link PersonalizedEntry}.
 *
 * @param entry - Contentful entry to test.
 * @returns `true` if the entry conforms to {@link PersonalizedEntry}, otherwise `false`.
 *
 * @example
 * ```ts
 * if (isPersonalizedEntry(entry)) {
 *   console.log(entry.fields.nt_experiences);
 * }
 * ```
 *
 * @public
 */
export function isPersonalizedEntry(entry: unknown): entry is PersonalizedEntry {
  return PersonalizedEntry.safeParse(entry).success
}

/**
 * Type guard for {@link MergeTagEntry}.
 *
 * @param entry - Value to test.
 * @returns `true` if the value conforms to {@link MergeTagEntry}, otherwise `false`.
 *
 * @public
 */
export function isMergeTagEntry(entry: unknown): entry is MergeTagEntry {
  return MergeTagEntry.safeParse(entry).success
}

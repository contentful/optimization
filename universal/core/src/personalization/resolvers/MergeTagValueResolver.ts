import { MergeTagEntry, Profile } from '@contentful/optimization-api-client'
import { get } from 'es-toolkit/compat'
import { logger } from 'logger'

/** Base string for log messages when merge-tag resolution fails. */
const RESOLUTION_WARNING_BASE = '[Personalization] Could not resolve Merge Tag value:'

/**
 * Resolves merge tag values from a {@link Profile}.
 *
 * @public
 * @remarks
 * *Merge tags* are references to user profile data that may be embedded in content
 * and expanded at runtime. This resolver normalizes the merge-tag identifier into
 * a set of candidate selectors and searches the profile for a matching value.
 * Result values are returned as strings; numeric/boolean primitives are stringified.
 */
const MergeTagValueResolver = {
  /**
   * Type guard to ensure the input is a {@link MergeTagEntry}.
   *
   * @param embeddedEntryNodeTarget - Unknown value to validate.
   * @returns `true` if the input is a valid merge-tag entry.
   * @example
   * ```ts
   * if (MergeTagValueResolver.isMergeTagEntry(node)) {
   *   // safe to read fields
   * }
   * ```
   */
  isMergeTagEntry(embeddedEntryNodeTarget: unknown): embeddedEntryNodeTarget is MergeTagEntry {
    return MergeTagEntry.safeParse(embeddedEntryNodeTarget).success
  },

  /**
   * Generate a list of candidate selectors for a merge-tag ID.
   *
   * @param id - Merge-tag identifier (segments separated by `_`).
   * @returns Array of dot-path selectors to try against a profile.
   * @example
   * ```ts
   * // "profile_name_first" -> [
   * //   'profile',
   * //   'profile.name',
   * //   'profile.name.first'
   * // ]
   * const selectors = MergeTagValueResolver.normalizeSelectors('profile_name_first')
   * ```
   */
  normalizeSelectors(id: string): string[] {
    return id.split('_').map((_path, index, paths) => {
      const dotPath = paths.slice(0, index).join('.')
      const underScorePath = paths.slice(index).join('_')

      return [dotPath, underScorePath].filter((path) => path !== '').join('.')
    })
  },

  /**
   * Look up a merge-tag value from a profile using normalized selectors.
   *
   * @param id - Merge-tag identifier.
   * @param profile - Profile from which to resolve the value.
   * @returns A stringified primitive if found; otherwise `undefined`.
   * @example
   * ```ts
   * const value = MergeTagValueResolver.getValueFromProfile('user_email', profile)
   * if (value) sendEmailTo(value)
   * ```
   * @remarks
   * Only string/number/boolean primitives are returned; objects/arrays are ignored.
   */
  getValueFromProfile(id: string, profile?: Profile): string | undefined {
    const selectors = MergeTagValueResolver.normalizeSelectors(id)
    const matchingSelector = selectors.find((selector) => get(profile, selector))

    if (!matchingSelector) return undefined

    const value: unknown = get(profile, matchingSelector)

    if (
      !value ||
      (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
    )
      return undefined

    return `${value}`
  },

  /**
   * Resolve the display value for a merge-tag entry using the provided profile,
   * falling back to the entry's configured `nt_fallback` when necessary.
   *
   * @param mergeTagEntry - The merge-tag entry to resolve.
   * @param profile - Optional profile used for lookup.
   * @returns The resolved string, or `undefined` if the entry is invalid and no
   * fallback is available.
   * @example
   * ```ts
   * const text = MergeTagValueResolver.resolve(entry, profile)
   * render(text ?? 'Guest')
   * ```
   */
  resolve(mergeTagEntry: MergeTagEntry | undefined, profile?: Profile): string | undefined {
    if (!MergeTagValueResolver.isMergeTagEntry(mergeTagEntry)) {
      logger.warn(RESOLUTION_WARNING_BASE, 'supplied entry is not a Merge Tag entry')
      return
    }

    const {
      fields: { nt_fallback: fallback },
    } = mergeTagEntry

    if (!Profile.safeParse(profile).success) {
      logger.warn(RESOLUTION_WARNING_BASE, 'no valid profile')
      return fallback
    }

    return (
      MergeTagValueResolver.getValueFromProfile(mergeTagEntry.fields.nt_mergetag_id, profile) ??
      fallback
    )
  },
}

export default MergeTagValueResolver

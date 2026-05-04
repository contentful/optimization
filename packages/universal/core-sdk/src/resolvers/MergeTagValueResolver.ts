import type { MergeTagEntry } from '@contentful/optimization-api-client/api-schemas'
import { Profile, isMergeTagEntry } from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'

const logger = createScopedLogger('Optimization')

/**
 * Base string for log messages when merge-tag resolution fails.
 *
 * @internal
 */
const RESOLUTION_WARNING_BASE = 'Could not resolve Merge Tag value:'

const getAtPath = (value: unknown, path: string): unknown => {
  if (!value || typeof value !== 'object') return undefined
  if (!path) return value

  let current: unknown = value
  const segments = path.split('.').filter(Boolean)

  for (const segment of segments) {
    if (!current || (typeof current !== 'object' && typeof current !== 'function')) return undefined
    current = Reflect.get(current, segment)
  }

  return current
}

/**
 * Resolves merge tag values from a {@link Profile}.
 *
 * @public
 * @remarks
 * *Merge tags* are references to user profile data that can be embedded in content
 * and expanded at runtime. This resolver normalizes the merge-tag identifier into
 * a set of candidate selectors and searches the profile for a matching value.
 * Result values are returned as strings; numeric/boolean primitives are stringified.
 */
const MergeTagValueResolver = {
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
   * @remarks
   * Only string/number/boolean primitives are returned; objects/arrays are ignored.
   * @example
   * ```ts
   * const value = MergeTagValueResolver.getValueFromProfile('user_email', profile)
   * if (value) sendEmailTo(value)
   * ```
   */
  getValueFromProfile(id: string, profile?: Profile): string | undefined {
    const selectors = MergeTagValueResolver.normalizeSelectors(id)
    const matchingSelector = selectors.find((selector) => getAtPath(profile, selector))

    if (!matchingSelector) return undefined

    const value = getAtPath(profile, matchingSelector)

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
   * @remarks
   * The resolved value depends on the current request profile, so callers
   * must not reuse rendered output across users or requests unless the
   * cache varies on the same profile inputs.
   * @example
   * ```ts
   * const text = MergeTagValueResolver.resolve(entry, profile)
   * render(text ?? 'Guest')
   * ```
   */
  resolve(mergeTagEntry: MergeTagEntry | undefined, profile?: Profile): string | undefined {
    if (!isMergeTagEntry(mergeTagEntry)) {
      logger.warn(`${RESOLUTION_WARNING_BASE} supplied entry is not a Merge Tag entry`)
      return
    }

    const {
      fields: { nt_fallback: fallback },
    } = mergeTagEntry

    if (!Profile.safeParse(profile).success) {
      logger.warn(`${RESOLUTION_WARNING_BASE} no valid profile`)
      return fallback
    }

    return (
      MergeTagValueResolver.getValueFromProfile(mergeTagEntry.fields.nt_mergetag_id, profile) ??
      fallback
    )
  },
}

export default MergeTagValueResolver

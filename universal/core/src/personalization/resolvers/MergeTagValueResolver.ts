import { MergeTagEntry, Profile } from '@contentful/optimization-api-client'
import { get } from 'es-toolkit/compat'
import { logger } from 'logger'

const RESOLUTION_WARNING_BASE = '[Personalization] Could not resolve Merge Tag value:'

const MergeTagValueResolver = {
  isMergeTagEntry(embeddedEntryNodeTarget: unknown): embeddedEntryNodeTarget is MergeTagEntry {
    return MergeTagEntry.safeParse(embeddedEntryNodeTarget).success
  },

  normalizeSelectors(id: string): string[] {
    return id.split('_').map((_path, index, paths) => {
      const dotPath = paths.slice(0, index).join('.')
      const underScorePath = paths.slice(index).join('_')

      return [dotPath, underScorePath].filter((path) => path !== '').join('.')
    })
  },

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

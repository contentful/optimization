import { MergeTagEntry, Profile } from '@contentful/optimization-api-client'
import { get } from 'es-toolkit/compat'
import { logger } from 'logger'
import { profile as profileSignal } from '../../signals'

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

  getValueFromProfile(id: string, profile: Profile | undefined = profileSignal.value): unknown {
    const selectors = MergeTagValueResolver.normalizeSelectors(id)
    const matchingSelector = selectors.find((selector) => get(profile, selector))

    if (!matchingSelector) return

    return get(profile, matchingSelector)
  },

  resolve(
    mergeTagEntry: MergeTagEntry | undefined,
    profile: Profile | undefined = profileSignal.value,
  ): unknown {
    if (!Profile.safeParse(profile).success) {
      logger.warn(RESOLUTION_WARNING_BASE, 'no valid profile')
      return
    }

    if (!MergeTagValueResolver.isMergeTagEntry(mergeTagEntry)) {
      logger.warn(RESOLUTION_WARNING_BASE, 'supplied entry is not a Merge Tag entry')
      return
    }

    return (
      MergeTagValueResolver.getValueFromProfile(mergeTagEntry.fields.nt_mergetag_id, profile) ??
      mergeTagEntry.fields.nt_fallback
    )
  },
}

export default MergeTagValueResolver

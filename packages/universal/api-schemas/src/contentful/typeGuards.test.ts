import { describe, expect, it } from '@rstest/core'
import type { Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'
import { isEntryOfContentType, isResolvedContentfulEntry } from './typeGuards'

type HeroSkeleton = EntrySkeletonType<{ headline: EntryFieldTypes.Symbol }, 'hero'>

describe('isEntryOfContentType', () => {
  it('checks and narrows by content type ID', () => {
    const entry = {
      fields: {},
      metadata: {},
      sys: { contentType: { sys: { id: 'hero' } }, id: 'entry', type: 'Entry' },
    }
    if (!isResolvedContentfulEntry(entry)) throw new TypeError('Invalid entry fixture')

    expect(isEntryOfContentType<HeroSkeleton>(entry, 'hero')).toBe(true)
    expect(isEntryOfContentType<EntrySkeletonType>(entry, 'cta')).toBe(false)

    if (isEntryOfContentType<HeroSkeleton>(entry, 'hero')) {
      const narrowed: Entry<HeroSkeleton> = entry
      expect(narrowed).toBe(entry)
    }
  })
})

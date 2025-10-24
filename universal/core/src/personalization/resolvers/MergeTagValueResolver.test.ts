import type { MergeTagEntry, Profile } from '@contentful/optimization-api-client'
import { cloneDeep } from 'es-toolkit'
import MergeTagValueResolver from './MergeTagValueResolver'

const profile: Profile = {
  id: '',
  stableId: '',
  random: 0,
  audiences: [],
  traits: {
    firstname: 'John',
    nested: {
      foo: 'bar',
      baz: { qux: 'grml' },
      baz_qux: 'quux',
    },
    non_nested: 123,
  },
  location: {
    continent: 'EU',
  },
  session: {
    id: '1a2b3c4d5e6f7g8h9i0j',
    isReturningVisitor: false,
    landingPage: {
      url: '',
      referrer: '',
      query: {},
      search: '',
      path: '',
    },
    count: 2,
    activeSessionLength: 12,
    averageSessionLength: 43,
  },
}

const mergeTagEntry: MergeTagEntry = {
  metadata: {
    tags: [],
    concepts: [],
  },
  sys: {
    space: {
      sys: {
        type: 'Link',
        linkType: 'Space',
        id: 'uelxcuo7v97l',
      },
    },
    id: 'nM127uVevlpDWytfZRyum',
    type: 'Entry',
    createdAt: '2025-10-15T15:08:43.051Z',
    updatedAt: '2025-10-15T15:08:52.541Z',
    environment: {
      sys: {
        id: 'master',
        type: 'Link',
        linkType: 'Environment',
      },
    },
    publishedVersion: 6,
    revision: 2,
    contentType: {
      sys: {
        type: 'Link',
        linkType: 'ContentType',
        id: 'nt_mergetag',
      },
    },
    locale: 'en-US',
  },
  fields: {
    nt_name: '[Merge Tag] Continent',
    nt_fallback: 'Nowhere',
    nt_mergetag_id: 'location.continent',
  },
}

describe('MergeTagValueResolver', () => {
  describe('normalizeSelectors', () => {
    it('should create all combinations for deep paths', () => {
      expect(MergeTagValueResolver.normalizeSelectors('a_b_c')).toEqual(['a_b_c', 'a.b_c', 'a.b.c'])
    })

    it('should keep sub paths with dot notation', () => {
      expect(MergeTagValueResolver.normalizeSelectors('a.b_c')).toEqual(['a.b_c', 'a.b.c'])

      expect(MergeTagValueResolver.normalizeSelectors('a.b_c.d')).toEqual(['a.b_c.d', 'a.b.c.d'])

      expect(MergeTagValueResolver.normalizeSelectors('a_b_c.d')).toEqual([
        'a_b_c.d',
        'a.b_c.d',
        'a.b.c.d',
      ])
    })
  })

  describe('getValueFromProfile', () => {
    it('should return undefined if no value is found', () => {
      expect(MergeTagValueResolver.getValueFromProfile('a.b.c', profile)).toBeUndefined()
    })

    it('should return the value if found', () => {
      expect(MergeTagValueResolver.getValueFromProfile('traits.firstname', profile)).toEqual('John')
      expect(MergeTagValueResolver.getValueFromProfile('traits_firstname', profile)).toEqual('John')
      expect(MergeTagValueResolver.getValueFromProfile('traits.nested.foo', profile)).toEqual('bar')
      expect(MergeTagValueResolver.getValueFromProfile('traits_nested.baz_qux', profile)).toEqual(
        'quux',
      )
      expect(MergeTagValueResolver.getValueFromProfile('traits_nested.baz.qux', profile)).toEqual(
        'grml',
      )
      expect(MergeTagValueResolver.getValueFromProfile('traits.non_nested', profile)).toEqual(123)
    })
  })

  describe('isMergeTagEntry', () => {
    it('returns false when argument is not a merge tag entry', () => {
      expect(MergeTagValueResolver.isMergeTagEntry({})).toBeFalsy()
    })

    it('returns true when argument is a merge tag entry', () => {
      expect(MergeTagValueResolver.isMergeTagEntry(mergeTagEntry)).toBeTruthy()
    })
  })

  describe('resolve', () => {
    it('should return `undefined` when entry is invalid', () => {
      // @ts-expect-error-next-line
      expect(MergeTagValueResolver.resolve({}, profile)).toBeUndefined()
    })

    it('should return `undefined` when profile is invalid', () => {
      // @ts-expect-error-next-line
      expect(MergeTagValueResolver.resolve(mergeTagEntry, {})).toBeUndefined()
    })

    it('resolves the fallback value when the specified value can not be found', () => {
      const clonedProfile = cloneDeep(profile)

      delete clonedProfile.location.continent

      expect(MergeTagValueResolver.resolve(mergeTagEntry, clonedProfile)).toEqual('Nowhere')
    })

    it('resolves the expected value', () => {
      expect(MergeTagValueResolver.resolve(mergeTagEntry, profile)).toEqual('EU')
    })
  })
})

import { cloneDeep } from 'es-toolkit'
import { mergeTagEntry } from '../../test/fixtures/mergeTagEntry'
import { profile } from '../../test/fixtures/profile'
import MergeTagValueResolver from './MergeTagValueResolver'

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
      expect(MergeTagValueResolver.getValueFromProfile('traits.non_nested', profile)).toEqual('123')
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

    it('resolves the fallback value when profile is invalid', () => {
      // @ts-expect-error-next-line
      expect(MergeTagValueResolver.resolve(mergeTagEntry, {})).toEqual('Nowhere')
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

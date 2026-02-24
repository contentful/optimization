import { CHANGES_CACHE_KEY, PROFILE_CACHE_KEY } from '@contentful/optimization-core'
import LocalStore from './LocalStore'

describe('LocalStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    rs.restoreAllMocks()
  })

  it('deletes malformed JSON cache values', () => {
    localStorage.setItem(CHANGES_CACHE_KEY, '{bad-json')

    expect(LocalStore.changes).toBeUndefined()
    expect(localStorage.getItem(CHANGES_CACHE_KEY)).toBeNull()
  })

  it('deletes cache values that fail schema validation', () => {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ foo: 'bar' }))

    expect(LocalStore.profile).toBeUndefined()
    expect(localStorage.getItem(PROFILE_CACHE_KEY)).toBeNull()
  })

  it('swallows localStorage.removeItem failures during cache updates', () => {
    const removeSpy = rs.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })

    expect(() => {
      LocalStore.setCache(CHANGES_CACHE_KEY, undefined)
    }).not.toThrow()
    expect(removeSpy).toHaveBeenCalledWith(CHANGES_CACHE_KEY)
  })

  it('swallows localStorage.setItem failures during cache updates', () => {
    const setSpy = rs.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => {
      LocalStore.setCache(CHANGES_CACHE_KEY, { foo: 'bar' })
    }).not.toThrow()
    expect(setSpy).toHaveBeenCalledTimes(1)
  })
})

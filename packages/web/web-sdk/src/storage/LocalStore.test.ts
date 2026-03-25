import {
  ANONYMOUS_ID_KEY,
  ANONYMOUS_ID_KEY_LEGACY,
  CHANGES_CACHE_KEY,
  CONSENT_KEY,
  DEBUG_FLAG_KEY,
  PROFILE_CACHE_KEY,
  SELECTED_OPTIMIZATIONS_CACHE_KEY,
} from '@contentful/optimization-core/constants'
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

  it('prefers legacy anonymous id and clears legacy key', () => {
    localStorage.setItem(ANONYMOUS_ID_KEY_LEGACY, 'legacy-anon')
    localStorage.setItem(ANONYMOUS_ID_KEY, 'modern-anon')

    expect(LocalStore.anonymousId).toBe('legacy-anon')
    expect(localStorage.getItem(ANONYMOUS_ID_KEY_LEGACY)).toBeNull()
    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBe('modern-anon')
  })

  it('reads and writes anonymous id via modern key', () => {
    LocalStore.anonymousId = 'anon-123'
    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBe('anon-123')
    expect(LocalStore.anonymousId).toBe('anon-123')

    LocalStore.anonymousId = undefined
    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBeNull()
  })

  it('translates consent between storage strings and booleans', () => {
    LocalStore.consent = true
    expect(localStorage.getItem(CONSENT_KEY)).toBe('accepted')
    expect(LocalStore.consent).toBe(true)

    LocalStore.consent = false
    expect(localStorage.getItem(CONSENT_KEY)).toBe('denied')
    expect(LocalStore.consent).toBe(false)

    LocalStore.consent = undefined
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull()
    expect(LocalStore.consent).toBeUndefined()
  })

  it('returns undefined for unrecognized consent value', () => {
    localStorage.setItem(CONSENT_KEY, 'unknown')
    expect(LocalStore.consent).toBeUndefined()
  })

  it('reads and writes debug flag values', () => {
    LocalStore.debug = true
    expect(localStorage.getItem(DEBUG_FLAG_KEY)).toBe('true')
    expect(LocalStore.debug).toBe(true)

    LocalStore.debug = false
    expect(localStorage.getItem(DEBUG_FLAG_KEY)).toBe('false')
    expect(LocalStore.debug).toBe(false)

    LocalStore.debug = undefined
    expect(localStorage.getItem(DEBUG_FLAG_KEY)).toBeNull()
    expect(LocalStore.debug).toBeUndefined()
  })

  it('preserves consent/debug on reset by default', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    localStorage.setItem(DEBUG_FLAG_KEY, 'true')
    localStorage.setItem(ANONYMOUS_ID_KEY, 'anon')
    localStorage.setItem(CHANGES_CACHE_KEY, '{"foo":1}')
    localStorage.setItem(PROFILE_CACHE_KEY, '{"foo":2}')
    localStorage.setItem(SELECTED_OPTIMIZATIONS_CACHE_KEY, '{"foo":3}')

    LocalStore.reset()

    expect(localStorage.getItem(CONSENT_KEY)).toBe('accepted')
    expect(localStorage.getItem(DEBUG_FLAG_KEY)).toBe('true')
    expect(localStorage.getItem(ANONYMOUS_ID_KEY)).toBeNull()
    expect(localStorage.getItem(CHANGES_CACHE_KEY)).toBeNull()
    expect(localStorage.getItem(PROFILE_CACHE_KEY)).toBeNull()
    expect(localStorage.getItem(SELECTED_OPTIMIZATIONS_CACHE_KEY)).toBeNull()
  })

  it('can reset consent/debug when requested', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    localStorage.setItem(DEBUG_FLAG_KEY, 'true')

    LocalStore.reset({ resetConsent: true, resetDebug: true })

    expect(localStorage.getItem(CONSENT_KEY)).toBeNull()
    expect(localStorage.getItem(DEBUG_FLAG_KEY)).toBeNull()
  })

  it('writes raw strings without JSON encoding', () => {
    LocalStore.setCache(CHANGES_CACHE_KEY, 'raw-string')
    expect(localStorage.getItem(CHANGES_CACHE_KEY)).toBe('raw-string')
  })

  it('JSON-encodes non-string values in setCache', () => {
    LocalStore.setCache(CHANGES_CACHE_KEY, { ok: true, count: 2 })
    expect(localStorage.getItem(CHANGES_CACHE_KEY)).toBe('{"ok":true,"count":2}')
  })
})

import {
  decodeConsentStorageValue,
  encodeConsentStorageValue,
  resolvePersistedPersistenceConsent,
} from './ConsentStorage'

describe('ConsentStorage', () => {
  it('encodes and decodes the stable accepted and denied values', () => {
    expect(encodeConsentStorageValue(true)).toBe('accepted')
    expect(encodeConsentStorageValue(false)).toBe('denied')
    expect(encodeConsentStorageValue(undefined)).toBeUndefined()

    expect(decodeConsentStorageValue('accepted')).toBe(true)
    expect(decodeConsentStorageValue('denied')).toBe(false)
    expect(decodeConsentStorageValue('unknown')).toBeUndefined()
  })

  it('falls back to legacy accepted event consent for persistence consent', () => {
    expect(resolvePersistedPersistenceConsent(undefined, true)).toBe(true)
    expect(resolvePersistedPersistenceConsent(undefined, false)).toBeUndefined()
    expect(resolvePersistedPersistenceConsent(false, true)).toBe(false)
    expect(resolvePersistedPersistenceConsent(true, false)).toBe(true)
  })
})

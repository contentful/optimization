/**
 * Stable consent value stored by SDK platform persistence.
 *
 * @public
 */
export type ConsentStorageValue = 'accepted' | 'denied'

/**
 * Encode a boolean consent value for durable platform storage.
 *
 * @param consent - Runtime consent value.
 * @returns Stable storage value, or `undefined` when no value should be stored.
 *
 * @public
 */
export function encodeConsentStorageValue(
  consent: boolean | undefined,
): ConsentStorageValue | undefined {
  return consent === undefined ? undefined : consent ? 'accepted' : 'denied'
}

/**
 * Decode a durable platform consent value.
 *
 * @param value - Stored value read from a platform store.
 * @returns Runtime boolean consent, or `undefined` for absent/unrecognized values.
 *
 * @public
 */
export function decodeConsentStorageValue(value: unknown): boolean | undefined {
  return value === 'accepted' ? true : value === 'denied' ? false : undefined
}

/**
 * Resolve stored persistence consent while preserving the legacy event-consent fallback.
 *
 * @param persistenceConsent - Value stored in the dedicated persistence-consent key.
 * @param consent - Value stored in the legacy event-consent key.
 * @returns Dedicated persistence consent, or `true` for legacy accepted consent.
 *
 * @public
 */
export function resolvePersistedPersistenceConsent(
  persistenceConsent: boolean | undefined,
  consent: boolean | undefined,
): boolean | undefined {
  return persistenceConsent ?? (consent === true ? true : undefined)
}

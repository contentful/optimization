/**
 * Polyfills for React Native
 *
 * React Native doesn't have some modern JavaScript APIs by default.
 * This file adds necessary polyfills for:
 * - crypto.randomUUID() (Web Crypto API)
 * - Iterator helpers (ES2025 features like .toArray())
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Polyfill requires runtime checks */
/* eslint-disable @typescript-eslint/unbound-method -- Assigning to global methods */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- UUID type assertion is safe */

// Polyfill ES2025 iterator helpers (.toArray(), .filter(), .map(), etc.)
// This polyfill is Metro-compatible unlike core-js
import 'es-iterator-helpers/auto'

// Polyfill crypto.getRandomValues() for React Native
import 'react-native-get-random-values'
import uuid from 'react-native-uuid'

// Polyfill the crypto global if it doesn't exist
if (typeof global.crypto === 'undefined') {
  // @ts-expect-error - Polyfilling global crypto object
  global.crypto = {}
}

// Add randomUUID method
const randomUUID = (): `${string}-${string}-${string}-${string}-${string}` =>
  uuid.v4() as `${string}-${string}-${string}-${string}-${string}`

global.crypto.randomUUID ||= randomUUID

// Also set on globalThis for broader compatibility
if (typeof globalThis !== 'undefined') {
  const { crypto } = global
  if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = crypto
  }
}

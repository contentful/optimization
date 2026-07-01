/**
 * Returns `true` when the current environment has a browser `window` global.
 *
 * @remarks
 * Used to decide whether browser-only features (singleton enforcement,
 * DOM listeners, cookies) should be activated. Extracted as a named
 * function so tests can mock the result without manipulating globals.
 *
 * @internal
 */
export const isBrowser = (): boolean => typeof window !== 'undefined'

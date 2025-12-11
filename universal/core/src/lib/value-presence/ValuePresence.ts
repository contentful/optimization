/**
 * A scope identifier for grouping values.
 *
 * @remarks
 * Use a non-empty string for a named scope. Use `undefined` for the
 * "global/default" scope. An empty string (`""`) passed to the constructor
 * initializer is normalized to `undefined`.
 *
 * @public
 */
type ValuePresenceScope = string | undefined

/**
 * Tracks whether a given value is present within one or more logical scopes.
 *
 * @remarks
 * - Scope names are case-sensitive.
 * - Presence is based on `Set.has` reference equality for objects and
 *   value equality for primitives.
 *
 * @example
 * ```ts
 * const presence = new ValuePresence({ default: ['a', 'b'] })
 * presence.isPresent('default', 'a') // true
 * presence.addValue('default', 'c')
 * presence.removeValue('default', 'b')
 * presence.reset('default')
 * ```
 *
 * @see {@link ValuePresenceScope}
 * @public
 */
class ValuePresence {
  /**
   * Internal map of scope -> set of values present in that scope.
   *
   * @internal
   */
  readonly #map: Map<ValuePresenceScope, Set<unknown>>

  /**
   * Create a new {@link ValuePresence}.
   *
   * @param defaultMap - Optional initial data. Keys are scope names; values are arrays of items to seed.
   * Empty-string keys are normalized to the default scope (`undefined`).
   *
   * @remarks
   * - If `defaultMap` contains duplicate items for a scope, duplicates are collapsed by the `Set`.
   */
  constructor(defaultMap?: Record<string, unknown[]>) {
    const map = new Map<ValuePresenceScope, Set<unknown>>()

    if (defaultMap)
      Object.entries(defaultMap).map(([scope, values]) =>
        map.set(scope.length ? scope : undefined, new Set(values)),
      )

    this.#map = map
  }

  /**
   * Check whether a value is present within a given scope.
   *
   * @param scope - The scope to check. Use `undefined` for the default scope.
   * @param value - The value to test for presence.
   * @returns `true` if the value is present in the specified scope; otherwise `false`.
   *
   * @remarks
   * Presence testing uses `Set.prototype.has` semantics.
   *
   * @example
   * ```ts
   * presence.isPresent(undefined, 42) // e.g., true or false
   * ```
   *
   * @public
   */
  isPresent(scope: ValuePresenceScope, value: unknown): boolean {
    return this.#map.get(scope)?.has(value) ?? false
  }

  /**
   * Add a value to a scope, creating the scope if it does not exist.
   *
   * @param scope - Scope to add the value to. Use `undefined` for the default scope.
   * @param value - The value to add.
   * @returns void
   *
   * @remarks
   * - No-op if the value is already present (due to `Set` semantics).
   *
   * @example
   * ```ts
   * presence.addValue('users', userId)
   * ```
   *
   * @public
   */
  addValue(scope: ValuePresenceScope, value: unknown): void {
    const values = this.#map.get(scope)

    if (!values) {
      this.#map.set(scope, new Set([value]))
    } else {
      values.add(value)
    }
  }

  /**
   * Remove a value from a scope.
   *
   * @param scope - Scope to remove from. Use `undefined` for the default scope.
   * @param value - The value to remove.
   * @returns void
   *
   * @remarks
   * If the scope does not exist or the value is not present, this is a no-op.
   *
   * @example
   * ```ts
   * presence.removeValue('users', userId)
   * ```
   *
   * @public
   */
  removeValue(scope: ValuePresenceScope, value: unknown): void {
    this.#map.get(scope)?.delete(value)
  }

  /**
   * Clear values from a single scope, or from all scopes.
   *
   * @param scope - If provided, clears only that scope. If omitted, clears all scopes.
   * @returns void
   *
   * @remarks
   * - When called with a specific scope that does not exist, this is a no-op.
   * - When called with no arguments, all scopes and values are removed.
   * - Clearing a non-existent scope will not create the scope.
   *
   * @example
   * ```ts
   * // Clear one scope
   * presence.reset('users')
   *
   * // Clear all scopes
   * presence.reset()
   * ```
   *
   * @public
   */
  reset(scope?: ValuePresenceScope): void {
    if (scope !== undefined) {
      this.#map.get(scope)?.clear()
    } else {
      this.#map.clear()
    }
  }
}

export default ValuePresence

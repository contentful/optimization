import type { ChangeArray, Flags } from '@contentful/optimization-api-client'

/**
 * Resolves a {@link Flags} map from a list of optimization changes.
 *
 * @public
 * @remarks
 * Given an Optimization {@link ChangeArray}, this utility flattens the list into a
 * simple key–value object suitable for quick lookups in client code. When `changes`
 * is `undefined`, an empty object is returned. If a change value is wrapped in an
 * object like `{ value: { ... } }`, this resolver unwraps it to the underlying object.
 */
const FlagsResolver = {
  /**
   * Build a flattened map of flag keys to values from a change list.
   *
   * @param changes - The change list returned by the optimization service.
   * @returns A map of flag keys to their resolved values.
   * @example
   * ```ts
   * const flags = FlagsResolver.resolve(data.changes)
   * if (flags['theme'] === 'dark') enableDarkMode()
   * ```
   * @example
   * // Handles wrapped values produced by the API
   * ```ts
   * const flags = FlagsResolver.resolve([
   *   { type: 'Variable', key: 'price', value: { value: { amount: 10, currency: 'USD' } } }
   * ])
   * console.log(flags.price.amount) // 10
   * ```
   */
  resolve(changes?: ChangeArray): Flags {
    if (!changes) return {}

    return changes.reduce<Flags>((acc, { key, value }) => {
      const actualValue =
        typeof value === 'object' &&
        value !== null &&
        'value' in value &&
        typeof value.value === 'object'
          ? value.value
          : value

      acc[key] = actualValue

      return acc
    }, {})
  },
}

export default FlagsResolver

import type { AutoPagePayload } from './types'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeRecords(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(override)) {
    const { [key]: previous } = result

    result[key] =
      isPlainObject(previous) && isPlainObject(value) ? mergeRecords(previous, value) : value
  }

  return result
}

/**
 * Compose page payload layers from lowest to highest precedence.
 *
 * Each subsequent layer deep-merges over the previous one; later arguments win
 * on key conflicts. `undefined` layers are skipped.
 *
 * @internal
 */
export function composePagePayload(
  ...layers: ReadonlyArray<AutoPagePayload | undefined>
): AutoPagePayload {
  return layers.reduce<Record<string, unknown>>(
    (accumulator, layer) => (layer ? mergeRecords(accumulator, layer) : accumulator),
    {},
  ) as AutoPagePayload
}

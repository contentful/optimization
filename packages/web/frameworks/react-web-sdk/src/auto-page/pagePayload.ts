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

export function composePagePayload(
  staticPayload: AutoPagePayload | undefined,
  dynamicPayload: AutoPagePayload | undefined,
): AutoPagePayload {
  return mergeRecords(staticPayload ?? {}, dynamicPayload ?? {}) as AutoPagePayload
}

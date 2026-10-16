export const NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX = 'x-ctfl-opt-'
export const NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER = `${NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX}request-url`
export const NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER = `${NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX}server-data`

export function serializeNextjsOptimizationRequestContext(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value))
}

export function parseNextjsOptimizationRequestContext(value: string | null): unknown {
  if (!value) return undefined

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value))
    return parsed
  } catch (_error) {
    return undefined
  }
}

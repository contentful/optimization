export const NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX = 'x-ctfl-opt-'
export const NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER = `${NEXTJS_OPTIMIZATION_REQUEST_HEADER_PREFIX}request-url`

export function normalizeNextjsAppRequestUrl(requestUrl: string): string {
  const url = new URL(requestUrl)
  url.searchParams.delete('_rsc')
  return url.toString()
}

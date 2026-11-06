import type { Page, Query } from '@contentful/optimization-api-client/api-schemas'

export interface CreatePageContextFromUrlOptions {
  readonly referrer?: string
}

/**
 * Convert URL search parameters into the {@link Query} shape the Experience API accepts.
 *
 * @param searchParams - Search parameters to convert.
 * @returns A key that appears once maps to its value; a repeated key maps to all of its
 * values in order.
 *
 * @public
 */
export function createQueryFromSearchParams(searchParams: URLSearchParams): Query {
  return Object.fromEntries(
    [...new Set(searchParams.keys())].map((key) => {
      const values = searchParams.getAll(key)
      return [key, values.length === 1 ? (values[0] ?? '') : values]
    }),
  )
}

export function createPageContextFromUrl(
  requestUrl: string | URL,
  { referrer }: CreatePageContextFromUrlOptions = {},
): Page {
  const url = requestUrl instanceof URL ? requestUrl : new URL(requestUrl)

  return {
    path: url.pathname,
    query: createQueryFromSearchParams(url.searchParams),
    referrer: referrer ?? '',
    search: url.search,
    url: url.toString(),
  }
}

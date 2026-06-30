import type { Page } from '@contentful/optimization-api-client/api-schemas'

export interface CreatePageContextFromUrlOptions {
  readonly referrer?: string
}

export function createPageContextFromUrl(
  requestUrl: string | URL,
  { referrer }: CreatePageContextFromUrlOptions = {},
): Page {
  const url = requestUrl instanceof URL ? requestUrl : new URL(requestUrl)

  return {
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    referrer: referrer ?? '',
    search: url.search,
    url: url.toString(),
  }
}

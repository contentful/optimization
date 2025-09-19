import type { Page, Query } from '@contentful/optimization-core'
import LocalStore from '../storage/LocalStore'

function buildQuery(url: string | URL): Query {
  return new URL(url).searchParams.entries().reduce((entries: Query, [k, v]) => {
    entries[k] = v
    return entries
  }, {})
}

export function getAnonymousId(): string | undefined {
  return LocalStore.anonymousId
}

export function getLocale(): string {
  const { languages, language } = navigator

  return languages[0] ?? language
}

export function getPageProperties(): Page {
  try {
    const url = new URL(window.location.href)
    const { referrer, title } = document

    return {
      path: url.pathname,
      query: buildQuery(url),
      referrer,
      search: url.search,
      title,
      url: url.toString(),
    }
  } catch (_error) {
    return {
      path: '',
      query: {},
      referrer: '',
      search: '',
      title: '',
      url: '',
    }
  }
}

export function getUserAgent(): string {
  return navigator.userAgent
}

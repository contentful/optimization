import { logger, type Dictionary, type Page } from '@contentful/optimization-core'

/**
 * Build a plain-object representation of the query string from a URL.
 *
 * @param url - A URL instance or string from which to extract query parameters.
 * @returns A dictionary of query parameter keys to values.
 *
 * @internal
 */
function buildQuery(url: string | URL): Dictionary {
  return new URL(url).searchParams.entries().reduce((entries: Dictionary, [k, v]) => {
    entries[k] = v
    return entries
  }, {})
}

/**
 * Determine the preferred locale of the current browser.
 *
 * @returns The first language from `navigator.languages`, or `navigator.language`
 * if `languages` is not available.
 *
 * @public
 * @example
 * ```ts
 * const locale = getLocale()
 * ```
 */
export function getLocale(): string {
  const { languages, language } = navigator

  return languages[0] ?? language
}

/**
 * Collect page-related properties from the current browser context.
 *
 * @returns A {@link Page} object describing the current URL, dimensions and
 * metadata. If an error occurs while reading from `window` or `document`,
 * a minimal object with empty strings and no query parameters is returned.
 *
 * @public
 * @example
 * ```ts
 * const page = getPageProperties()
 * optimization.page({ name: page.title, properties: page })
 * ```
 */
export function getPageProperties(): Page {
  try {
    const url = new URL(window.location.href)
    const { referrer, title } = document

    return {
      hash: window.location.hash,
      height: window.innerHeight,
      path: url.pathname,
      query: buildQuery(url),
      referrer,
      search: url.search,
      title,
      url: url.toString(),
      width: window.innerWidth,
    }
  } catch (error) {
    if (error instanceof Error) logger.error(error)

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

/**
 * Get the user agent string reported by the current browser.
 *
 * @returns The value of `navigator.userAgent`.
 *
 * @public
 * @example
 * ```ts
 * const ua = getUserAgent()
 * ```
 */
export function getUserAgent(): string {
  return navigator.userAgent
}

/**
 * Contentful locale configuration used by SDK layers to resolve the CDA locale.
 *
 * @public
 */
export interface ContentfulLocales {
  /** Locale to use when no runtime or request candidate matches. */
  readonly default: string
  /** Optional locale codes configured in the Contentful space, in preferred match order. */
  readonly supported?: readonly string[]
}

/**
 * Options for resolving a Contentful locale from runtime or request candidates.
 *
 * @public
 */
export interface ResolveContentfulLocaleOptions {
  /** Explicit app/content locale candidate. */
  readonly locale?: string
  /** Contentful locale configuration supplied by the consumer. */
  readonly contentfulLocales?: ContentfulLocales
  /** Runtime, device, route, or request locale candidates. */
  readonly candidates?: ReadonlyArray<string | null | undefined>
}

interface SupportedLocale {
  readonly value: string
  readonly matchKey: string
}

const LOCALE_PATTERN = /^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i

/**
 * Normalize a locale candidate before matching it to Contentful locale codes.
 *
 * @public
 */
export function normalizeLocale(locale: string | null | undefined): string | undefined {
  const normalizedLocale = locale?.trim().replace(/_/g, '-')
  const matchKey = normalizedLocale?.toLowerCase()

  if (
    !normalizedLocale ||
    normalizedLocale === '*' ||
    matchKey === 'und' ||
    !LOCALE_PATTERN.test(normalizedLocale)
  ) {
    return undefined
  }

  return normalizedLocale
}

function describeLocaleValue(locale: unknown): string {
  return typeof locale === 'string' ? JSON.stringify(locale) : String(locale)
}

/**
 * Normalize an explicit locale value and throw when it is not usable.
 *
 * @public
 */
export function normalizeExplicitLocale(locale: unknown, name = 'locale'): string | undefined {
  if (locale === undefined) {
    return undefined
  }

  if (typeof locale !== 'string') {
    throw new Error(`${name} must be a locale string.`)
  }

  const normalizedLocale = normalizeLocale(locale)
  if (normalizedLocale === undefined) {
    throw new Error(
      `${name} must be a valid locale string, received ${describeLocaleValue(locale)}.`,
    )
  }

  return normalizedLocale
}

function getLocaleMatchKey(locale: string): string {
  return locale.toLowerCase()
}

function getFallbackMatchKeys(matchKey: string): string[] {
  const subtags = matchKey.split('-')
  const fallbackMatchKeys: string[] = []

  for (let size = subtags.length - 1; size > 0; size -= 1) {
    fallbackMatchKeys.push(subtags.slice(0, size).join('-'))
  }

  return fallbackMatchKeys
}

function getSupportedLocales(contentfulLocales: ContentfulLocales): SupportedLocale[] {
  const seen = new Set<string>()
  const supportedLocales: SupportedLocale[] = []
  const configuredSupportedLocales = contentfulLocales.supported ?? []

  for (const [index, value] of [
    ...configuredSupportedLocales,
    contentfulLocales.default,
  ].entries()) {
    const normalized = normalizeExplicitLocale(
      value,
      index < configuredSupportedLocales.length
        ? `contentfulLocales.supported[${index}]`
        : 'contentfulLocales.default',
    )

    if (normalized === undefined) {
      continue
    }

    const matchKey = getLocaleMatchKey(normalized)
    if (seen.has(matchKey)) {
      continue
    }

    seen.add(matchKey)
    // Contentful locale codes are API identifiers, so keep the configured value for output
    // and use a private key only for lenient matching.
    supportedLocales.push({ value, matchKey })
  }

  return supportedLocales
}

function toCandidateMatchKeys({
  candidates,
  locale,
}: Pick<ResolveContentfulLocaleOptions, 'candidates' | 'locale'>): string[] {
  const localeCandidates: string[] = []
  const explicitLocale = normalizeExplicitLocale(locale)

  if (explicitLocale !== undefined) {
    return [getLocaleMatchKey(explicitLocale)]
  }

  for (const candidate of candidates ?? []) {
    const normalizedCandidate = normalizeLocale(candidate)
    if (normalizedCandidate !== undefined) {
      localeCandidates.push(normalizedCandidate)
    }
  }

  return localeCandidates.map(getLocaleMatchKey)
}

/**
 * Resolve the Contentful locale for CDA entry fetches and Experience API localization.
 *
 * @public
 */
export function resolveContentfulLocale({
  candidates = [],
  contentfulLocales,
  locale,
}: ResolveContentfulLocaleOptions): string | undefined {
  const candidateMatchKeys = toCandidateMatchKeys({ candidates, locale })

  if (contentfulLocales === undefined) {
    return locale === undefined ? undefined : normalizeExplicitLocale(locale)
  }

  const supportedLocales = getSupportedLocales(contentfulLocales)

  for (const candidateMatchKey of candidateMatchKeys) {
    const exactMatch = supportedLocales.find(
      (supportedLocale) => supportedLocale.matchKey === candidateMatchKey,
    )

    if (exactMatch !== undefined) {
      return exactMatch.value
    }
  }

  for (const candidateMatchKey of candidateMatchKeys) {
    for (const fallbackMatchKey of getFallbackMatchKeys(candidateMatchKey)) {
      const fallbackMatch = supportedLocales.find(
        (supportedLocale) =>
          supportedLocale.matchKey === fallbackMatchKey ||
          supportedLocale.matchKey.startsWith(`${fallbackMatchKey}-`),
      )

      if (fallbackMatch !== undefined) {
        return fallbackMatch.value
      }
    }
  }

  return contentfulLocales.default
}

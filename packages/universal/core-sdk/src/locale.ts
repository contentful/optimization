const LOCALE_PATTERN = /^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i

/**
 * Normalize a locale value before using it for SDK Experience API requests or events.
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

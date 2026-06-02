import {
  normalizeExplicitLocale,
  normalizeLocale,
  resolveContentfulLocale,
  type ContentfulLocales,
} from './locale'

const contentfulLocales: ContentfulLocales = {
  default: 'en-US',
  supported: ['en-US', 'de-DE', 'fr-FR'],
}

describe('locale helpers', () => {
  it('normalizes locale candidates', () => {
    expect(normalizeLocale(' de_DE ')).toBe('de-DE')
    expect(normalizeLocale('*')).toBeUndefined()
    expect(normalizeLocale('und')).toBeUndefined()
    expect(normalizeLocale('UND')).toBeUndefined()
    expect(normalizeLocale('')).toBeUndefined()
    expect(normalizeLocale('not a locale')).toBeUndefined()
  })

  it('throws for invalid explicit locale values', () => {
    expect(() => normalizeExplicitLocale('*')).toThrow(/valid locale/)
    expect(() => normalizeExplicitLocale('not a locale')).toThrow(/valid locale/)
    expect(() => normalizeExplicitLocale(null)).toThrow(/locale string/)
  })

  it('uses explicit locales as candidates instead of raw overrides', () => {
    expect(
      resolveContentfulLocale({
        contentfulLocales,
        candidates: ['de-DE'],
        locale: 'de-AT',
      }),
    ).toBe('de-DE')

    expect(
      resolveContentfulLocale({
        contentfulLocales,
        candidates: ['de-DE'],
        locale: 'it-IT',
      }),
    ).toBe('en-US')
  })

  it('returns normalized explicit locales when no Contentful locale config is present', () => {
    expect(resolveContentfulLocale({ locale: ' pt_BR ' })).toBe('pt-BR')
  })

  it('returns undefined when no locale config or explicit locale is present', () => {
    expect(resolveContentfulLocale({ candidates: ['de-DE'] })).toBeUndefined()
  })

  it('resolves default-only Contentful locale config to the configured default', () => {
    expect(
      resolveContentfulLocale({
        contentfulLocales: {
          default: 'en-US',
        },
        candidates: ['de-AT'],
      }),
    ).toBe('en-US')
  })

  it('preserves configured default locale codes in default-only config', () => {
    expect(
      resolveContentfulLocale({
        contentfulLocales: {
          default: 'EN_us',
        },
        candidates: ['de-DE'],
      }),
    ).toBe('EN_us')
  })

  it('validates default-only Contentful locale config', () => {
    expect(() =>
      resolveContentfulLocale({
        contentfulLocales: {
          default: '*',
        },
      }),
    ).toThrow(/contentfulLocales.default/)
  })

  it('resolves exact supported locale matches first', () => {
    expect(
      resolveContentfulLocale({
        contentfulLocales,
        candidates: ['fr-FR', 'de-DE'],
      }),
    ).toBe('fr-FR')
  })

  it('resolves exact matches case-insensitively before language fallback', () => {
    expect(
      resolveContentfulLocale({
        contentfulLocales: {
          default: 'en-US',
          supported: ['en-US', 'fr-FR', 'fr-CA'],
        },
        candidates: ['FR_ca'],
      }),
    ).toBe('fr-CA')
  })

  it('checks exact matches for all candidates before using fallback matches', () => {
    expect(
      resolveContentfulLocale({
        contentfulLocales,
        candidates: ['de-AT', 'fr-FR'],
      }),
    ).toBe('fr-FR')
  })

  it('resolves language-only matches by supported locale order', () => {
    expect(
      resolveContentfulLocale({
        contentfulLocales,
        candidates: ['de-AT'],
      }),
    ).toBe('de-DE')
  })

  it('resolves language-only matches case-insensitively by supported locale order', () => {
    expect(
      resolveContentfulLocale({
        contentfulLocales: {
          default: 'en-US',
          supported: ['en-US', 'fr-FR', 'fr-CA'],
        },
        candidates: ['FR-BE'],
      }),
    ).toBe('fr-FR')
  })

  it('resolves longer fallback prefixes before language-only fallback', () => {
    expect(
      resolveContentfulLocale({
        contentfulLocales: {
          default: 'en-US',
          supported: ['zh-Hans-CN', 'zh-Hant-TW'],
        },
        candidates: ['zh-Hant-HK'],
      }),
    ).toBe('zh-Hant-TW')
  })

  it('returns configured Contentful locale codes without canonicalizing them', () => {
    expect(
      resolveContentfulLocale({
        contentfulLocales: {
          default: 'EN_us',
          supported: ['pt_BR'],
        },
        candidates: ['pt-BR'],
      }),
    ).toBe('pt_BR')

    expect(
      resolveContentfulLocale({
        contentfulLocales: {
          default: 'EN_us',
          supported: ['pt_BR'],
        },
        candidates: ['es-ES'],
      }),
    ).toBe('EN_us')
  })

  it('falls back to the configured default locale', () => {
    expect(
      resolveContentfulLocale({
        contentfulLocales,
        candidates: ['es-ES'],
      }),
    ).toBe('en-US')
  })

  it('ignores unsupported placeholder candidates', () => {
    expect(
      resolveContentfulLocale({
        contentfulLocales,
        candidates: ['*', 'UND', ' de_DE '],
      }),
    ).toBe('de-DE')
  })

  it('throws when configured Contentful locales are invalid', () => {
    expect(() =>
      resolveContentfulLocale({
        contentfulLocales: {
          default: '*',
          supported: ['en-US'],
        },
      }),
    ).toThrow(/contentfulLocales.default/)

    expect(() =>
      resolveContentfulLocale({
        contentfulLocales: {
          default: 'en-US',
          supported: ['not a locale'],
        },
      }),
    ).toThrow(/contentfulLocales.supported/)
  })
})

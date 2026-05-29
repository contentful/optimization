import { describe, expect, it, rs } from '@rstest/core'

rs.mock('react-native', () => ({
  AppState: {
    addEventListener: rs.fn(() => ({
      remove: rs.fn(),
    })),
  },
  Dimensions: { get: rs.fn(() => ({ width: 375, height: 667 })) },
  NativeModules: {},
  Platform: { OS: 'ios' },
}))

rs.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: rs.fn(),
    multiGet: rs.fn().mockResolvedValue([]),
    removeItem: rs.fn().mockResolvedValue(undefined),
    setItem: rs.fn().mockResolvedValue(undefined),
  },
}))

rs.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: rs.fn(() => () => undefined),
  },
}))

let restoreRuntimeLocale: (() => void) | undefined = undefined

function mockRuntimeLocale(locale: string): void {
  const formatter = new Intl.DateTimeFormat(locale)
  const dateTimeFormatSpy = rs.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => formatter)

  restoreRuntimeLocale = () => {
    dateTimeFormatSpy.mockRestore()
  }
}

describe('ContentfulOptimization locale resolution', () => {
  let optimization: { destroy: () => void } | undefined

  afterEach(() => {
    optimization?.destroy()
    optimization = undefined
    restoreRuntimeLocale?.()
    restoreRuntimeLocale = undefined
    rs.clearAllMocks()
  })

  it('resolves contentfulLocales from the React Native runtime locale', async () => {
    mockRuntimeLocale('de-AT')
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'de-DE'],
      },
    })
    optimization = created

    expect(created.locale).toBe('de-DE')
    expect(Reflect.get(created.api.experience, 'locale')).toBe('de-DE')
  })

  it('falls back to default-only contentfulLocales from the React Native runtime locale', async () => {
    mockRuntimeLocale('de-AT')
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
      contentfulLocales: {
        default: 'en-US',
      },
    })
    optimization = created

    expect(created.locale).toBe('en-US')
    expect(Reflect.get(created.api.experience, 'locale')).toBe('en-US')
  })

  it('keeps api locale scoped to Experience API requests', async () => {
    mockRuntimeLocale('de-AT')
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
      api: { locale: 'fr-FR' },
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'de-DE'],
      },
    })
    optimization = created

    expect(created.locale).toBe('de-DE')
    expect(Reflect.get(created.api.experience, 'locale')).toBe('fr-FR')
  })

  it('uses top-level locale as the app/content locale input', async () => {
    mockRuntimeLocale('en-US')
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
      locale: 'de-AT',
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'de-DE'],
      },
    })
    optimization = created

    expect(created.locale).toBe('de-DE')
    expect(Reflect.get(created.api.experience, 'locale')).toBe('de-DE')
  })

  it('updates live locale without refreshing optimization data', async () => {
    const { default: ContentfulOptimization } = await import('./ContentfulOptimization')

    const created = await ContentfulOptimization.create({
      clientId: 'test-client-id',
      environment: 'main',
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'de-DE'],
      },
    })
    optimization = created
    const screen = rs.spyOn(created, 'screen')

    expect(created.setLocale('de-AT')).toBe('de-DE')
    expect(created.locale).toBe('de-DE')
    expect(Reflect.get(created.api.experience, 'locale')).toBe('de-DE')
    expect(screen).not.toHaveBeenCalled()
  })
})

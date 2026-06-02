import CoreStateful, { type CoreStatefulConfig } from './CoreStateful'
import { batch, signals } from './signals'

const config: CoreStatefulConfig = {
  clientId: 'key_123',
  environment: 'main',
}

function resetSignals(): void {
  batch(() => {
    signals.blockedEvent.value = undefined
    signals.changes.value = undefined
    signals.consent.value = undefined
    signals.event.value = undefined
    signals.locale.value = undefined
    signals.online.value = true
    signals.persistenceConsent.value = undefined
    signals.selectedOptimizations.value = undefined
    signals.previewPanelAttached.value = false
    signals.previewPanelOpen.value = false
    signals.profile.value = undefined
  })
}

describe('CoreStateful locale state', () => {
  const createdCores: CoreStateful[] = []
  const createCoreStateful = (overrides: Partial<CoreStatefulConfig> = {}): CoreStateful => {
    const core = new CoreStateful({
      ...config,
      ...overrides,
    })

    createdCores.push(core)

    return core
  }

  beforeEach(() => {
    resetSignals()
  })

  afterEach(() => {
    while (createdCores.length > 0) {
      createdCores.pop()?.destroy()
    }

    rs.restoreAllMocks()
  })

  it('initializes locale from contentfulLocales and exposes it through states.locale', () => {
    const core = createCoreStateful({
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'de-DE'],
      },
    })

    expect(core.locale).toBe('en-US')
    expect(core.states.locale.current).toBe('en-US')
    expect(Reflect.get(core.api.experience, 'locale')).toBe('en-US')
  })

  it('initializes locale from default-only contentfulLocales', () => {
    const core = createCoreStateful({
      contentfulLocales: {
        default: 'en-US',
      },
    })

    expect(core.locale).toBe('en-US')
    expect(core.states.locale.current).toBe('en-US')
    expect(Reflect.get(core.api.experience, 'locale')).toBe('en-US')
  })

  it('resolves explicit locale candidates and updates default Experience API locale', () => {
    const core = createCoreStateful({
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'de-DE'],
      },
      locale: 'de-AT',
    })
    const values: Array<string | undefined> = []
    const subscription = core.states.locale.subscribe((locale) => {
      values.push(locale)
    })

    const nextLocale = core.setLocale('fr-FR')

    expect(nextLocale).toBe('en-US')
    expect(core.locale).toBe('en-US')
    expect(core.states.locale.current).toBe('en-US')
    expect(Reflect.get(core.api.experience, 'locale')).toBe('en-US')
    expect(values).toEqual(['de-DE', 'en-US'])

    subscription.unsubscribe()
  })

  it('falls back to the configured default when setting locale with default-only contentfulLocales', () => {
    const core = createCoreStateful({
      contentfulLocales: {
        default: 'en-US',
      },
    })
    const values: Array<string | undefined> = []
    const subscription = core.states.locale.subscribe((locale) => {
      values.push(locale)
    })

    const nextLocale = core.setLocale('de-AT')

    expect(nextLocale).toBe('en-US')
    expect(core.locale).toBe('en-US')
    expect(core.states.locale.current).toBe('en-US')
    expect(Reflect.get(core.api.experience, 'locale')).toBe('en-US')
    expect(values).toEqual(['en-US'])

    subscription.unsubscribe()
  })

  it('keeps api.locale as the Experience API override when content locale changes', () => {
    const core = createCoreStateful({
      api: { locale: 'fr-FR' },
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'de-DE'],
      },
      locale: 'de-AT',
    })

    expect(core.locale).toBe('de-DE')
    expect(Reflect.get(core.api.experience, 'locale')).toBe('fr-FR')

    expect(core.setLocale('en-GB')).toBe('en-US')

    expect(core.locale).toBe('en-US')
    expect(Reflect.get(core.api.experience, 'locale')).toBe('fr-FR')
  })

  it('rejects invalid explicit locale changes without changing locale state', () => {
    const core = createCoreStateful({
      contentfulLocales: {
        default: 'en-US',
        supported: ['en-US', 'de-DE'],
      },
    })

    expect(() => core.setLocale('*')).toThrow(/valid locale/)
    expect(core.locale).toBe('en-US')
    expect(core.states.locale.current).toBe('en-US')
  })
})

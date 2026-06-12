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

  it('initializes the SDK locale from top-level locale', () => {
    const core = createCoreStateful({
      locale: ' de_DE ',
    })

    expect(core.locale).toBe('de-DE')
    expect(core.states.locale.current).toBe('de-DE')
    expect(Reflect.get(core.api.experience, 'locale')).toBe('de-DE')
    expect(core.eventBuilder.buildPageView({}).context.locale).toBe('de-DE')
  })

  it('omits the Experience API locale when no SDK locale is configured', () => {
    const core = createCoreStateful()

    expect(core.locale).toBeUndefined()
    expect(core.states.locale.current).toBeUndefined()
    expect(Reflect.get(core.api.experience, 'locale')).toBeUndefined()
  })

  it('updates state, event context, and default Experience API locale from setLocale()', () => {
    const core = createCoreStateful({
      locale: 'en-US',
    })
    const values: Array<string | undefined> = []
    const subscription = core.states.locale.subscribe((locale) => {
      values.push(locale)
    })

    const nextLocale = core.setLocale(' fr_FR ')

    expect(nextLocale).toBe('fr-FR')
    expect(core.locale).toBe('fr-FR')
    expect(core.states.locale.current).toBe('fr-FR')
    expect(Reflect.get(core.api.experience, 'locale')).toBe('fr-FR')
    expect(core.eventBuilder.buildPageView({}).context.locale).toBe('fr-FR')
    expect(values).toEqual(['en-US', 'fr-FR'])

    subscription.unsubscribe()
  })

  it('rejects invalid explicit locale changes without changing locale state', () => {
    const core = createCoreStateful({
      locale: 'en-US',
    })

    expect(() => core.setLocale('*')).toThrow(/valid locale/)
    expect(core.locale).toBe('en-US')
    expect(core.states.locale.current).toBe('en-US')
  })
})

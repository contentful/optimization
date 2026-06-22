import CoreStateful, { type CoreStatefulConfig } from './CoreStateful'
import type { ChangeArray } from './api-schemas'
import { batch, signals } from './signals'
import { profile as profileFixture } from './test/fixtures/profile'

const config: CoreStatefulConfig = {
  clientId: 'key_123',
  environment: 'main',
}

const FLAG_CHANGES: ChangeArray = [
  {
    key: 'dark-mode',
    type: 'Variable',
    value: true,
    meta: {
      experienceId: 'experience-id',
      variantIndex: 0,
    },
  },
]

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

describe('CoreStateful detached states', () => {
  let core: CoreStateful | undefined

  beforeEach(() => {
    resetSignals()
  })

  afterEach(() => {
    core?.destroy()
    core = undefined
    rs.restoreAllMocks()
  })

  it('supports detached states and flag access', () => {
    core = new CoreStateful({
      ...config,
      defaults: {
        consent: true,
        profile: profileFixture,
      },
    })
    const trackFlagView = rs.spyOn(core, 'trackFlagView').mockResolvedValue(undefined)
    const { states } = core
    const { flag } = states
    const canOptimizeValues: boolean[] = []
    const flagValues: Array<boolean | undefined> = []
    const flagOnceValues: boolean[] = []
    const canOptimizeSubscription = states.canOptimize.subscribe((value) => {
      canOptimizeValues.push(value)
    })
    const darkMode = flag('dark-mode')
    const flagSubscription = darkMode.subscribe((value) => {
      flagValues.push(value === undefined ? undefined : Boolean(value))
    })
    const flagOnceSubscription = darkMode.subscribeOnce((value) => {
      flagOnceValues.push(Boolean(value))
    })
    const onceValues: boolean[] = []
    const onceSubscription = states.canOptimize.subscribeOnce((value) => {
      onceValues.push(value)
    })

    batch(() => {
      signals.selectedOptimizations.value = []
      signals.changes.value = FLAG_CHANGES
    })

    expect(states.canOptimize.current).toBe(true)
    expect(darkMode.current).toBe(true)
    expect(canOptimizeValues).toEqual([false, true])
    expect(flagValues).toEqual([undefined, true])
    expect(flagOnceValues).toEqual([true])
    expect(onceValues).toEqual([false])
    expect(trackFlagView).toHaveBeenCalledTimes(2)
    expect(trackFlagView).toHaveBeenNthCalledWith(1, {
      componentId: 'dark-mode',
      experienceId: undefined,
      variantIndex: undefined,
    })
    expect(trackFlagView).toHaveBeenNthCalledWith(2, {
      componentId: 'dark-mode',
      experienceId: 'experience-id',
      variantIndex: 0,
    })

    canOptimizeSubscription.unsubscribe()
    flagSubscription.unsubscribe()
    flagOnceSubscription.unsubscribe()
    onceSubscription.unsubscribe()
  })
})

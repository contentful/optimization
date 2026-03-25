import type { BlockedEvent } from './BlockedEvent'
import CoreStateful, {
  type CoreStatefulConfig,
  type PreviewPanelSignalObject,
} from './CoreStateful'
import type { ChangeArray } from './api-schemas'
import type { TrackBuilderArgs, ViewBuilderArgs } from './events'
import type { QueueFlushFailureContext } from './lib/queue'
import { batch, signalFns, signals } from './signals'
import { PREVIEW_PANEL_SIGNAL_FNS_SYMBOL, PREVIEW_PANEL_SIGNALS_SYMBOL } from './symbols'
import { mergeTagEntry } from './test/fixtures/mergeTagEntry'
import { personalizedEntry } from './test/fixtures/personalizedEntry'
import { profile as profileFixture } from './test/fixtures/profile'
import { selectedPersonalizations as selectedPersonalizationsFixture } from './test/fixtures/selectedPersonalizations'

const config: CoreStatefulConfig = {
  clientId: 'key_123',
  environment: 'main',
}

const DARK_MODE_CHANGE: ChangeArray[number] = {
  key: 'dark-mode',
  type: 'Variable',
  value: true,
  meta: {
    experienceId: 'experience-id',
    variantIndex: 0,
  },
}

const OTHER_FLAG_CHANGE: ChangeArray[number] = {
  key: 'other-flag',
  type: 'Variable',
  value: 'A',
  meta: {
    experienceId: 'experience-id',
    variantIndex: 1,
  },
}

const FLAG_CHANGES: ChangeArray = [DARK_MODE_CHANGE, OTHER_FLAG_CHANGE]

class CoreStatefulTestHarness extends CoreStateful {
  getOnlineState(): boolean {
    return this.online
  }

  setOnlineState(isOnline: boolean): void {
    this.online = isOnline
  }
}

describe('CoreStateful blocked event handling', () => {
  const createdCores: CoreStateful[] = []
  const createCoreStateful = (overrides: Partial<CoreStatefulConfig> = {}): CoreStateful => {
    const core = new CoreStateful({
      ...config,
      ...overrides,
    })

    createdCores.push(core)

    return core
  }
  const createCoreStatefulHarness = (
    overrides: Partial<CoreStatefulConfig> = {},
  ): CoreStatefulTestHarness => {
    const core = new CoreStatefulTestHarness({
      ...config,
      ...overrides,
    })

    createdCores.push(core)

    return core
  }

  beforeEach(() => {
    batch(() => {
      signals.blockedEvent.value = undefined
      signals.changes.value = undefined
      signals.consent.value = undefined
      signals.event.value = undefined
      signals.online.value = true
      signals.selectedPersonalizations.value = undefined
      signals.previewPanelAttached.value = false
      signals.previewPanelOpen.value = false
      signals.profile.value = undefined
    })
  })

  afterEach(() => {
    while (createdCores.length > 0) {
      const core = createdCores.pop()

      core?.destroy()
    }

    rs.restoreAllMocks()
  })

  it('emits consent-blocked calls through callback and blockedEventStream', async () => {
    const onEventBlocked = rs.fn()
    const core = createCoreStateful({ onEventBlocked })
    const payload: TrackBuilderArgs = { event: 'purchase' }
    const blockedEvents: Array<BlockedEvent | undefined> = []
    const subscription = core.states.blockedEventStream.subscribe((event) => {
      blockedEvents.push(event)
    })

    await core.track(payload)

    expect(onEventBlocked).toHaveBeenCalledTimes(1)
    expect(onEventBlocked).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'consent',
        method: 'track',
      }),
    )
    expect(blockedEvents.at(-1)).toEqual(
      expect.objectContaining({
        reason: 'consent',
        method: 'track',
      }),
    )

    subscription.unsubscribe()
  })

  it('does not emit blocked events for repeated component view calls', async () => {
    const onEventBlocked = rs.fn()
    const core = createCoreStateful({
      defaults: { consent: true },
      onEventBlocked,
    })
    const payload: ViewBuilderArgs = {
      componentId: 'hero-banner',
      viewId: 'hero-banner-view-id',
      viewDurationMs: 1000,
    }

    await core.trackView(payload)
    await core.trackView(payload)

    expect(onEventBlocked).not.toHaveBeenCalled()
    expect(signals.blockedEvent.value).toBeUndefined()
  })

  it('defaults allowedEventTypes to identify/page/screen in core', async () => {
    const core = createCoreStateful()
    const payload: TrackBuilderArgs = { event: 'purchase' }
    const blockedEvents: Array<BlockedEvent | undefined> = []
    const subscription = core.states.blockedEventStream.subscribe((event) => {
      blockedEvents.push(event)
    })

    await core.identify({ userId: 'user-1' })
    await core.page({})
    await core.screen({ name: 'Home', properties: {}, screen: { name: 'Home' } })
    await core.track(payload)

    expect(blockedEvents.at(-1)).toEqual(
      expect.objectContaining({
        reason: 'consent',
        method: 'track',
      }),
    )

    subscription.unsubscribe()
  })

  it('uses shared queuePolicy.flush for insights retries when provided', async () => {
    rs.useFakeTimers()

    try {
      const onFlushFailure = rs.fn<(context: QueueFlushFailureContext) => void>()
      const core = createCoreStatefulHarness({
        defaults: {
          consent: true,
          profile: profileFixture,
        },
        queuePolicy: {
          flush: {
            baseBackoffMs: 123,
            jitterRatio: 0,
            maxBackoffMs: 123,
            onFlushFailure,
          },
        },
      })
      rs.spyOn(core.api.insights, 'sendBatchEvents').mockRejectedValue(new Error('insights-down'))

      core.setOnlineState(false)
      await core.trackClick({ componentId: 'hero-banner' })

      core.setOnlineState(true)
      await core.flush()

      expect(onFlushFailure).toHaveBeenCalledTimes(1)
      expect(onFlushFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          consecutiveFailures: 1,
          queuedBatches: 1,
          queuedEvents: 1,
          retryDelayMs: 123,
        }),
      )
    } finally {
      rs.clearAllTimers()
      rs.useRealTimers()
    }
  })

  it('uses queuePolicy.offlineMaxEvents and onOfflineDrop for Experience buffering', async () => {
    rs.useFakeTimers()

    try {
      const onDrop = rs.fn()
      const onFlushFailure = rs.fn<(context: QueueFlushFailureContext) => void>()
      const core = createCoreStatefulHarness({
        defaults: { consent: true },
        queuePolicy: {
          offlineMaxEvents: 2,
          onOfflineDrop: onDrop,
          flush: {
            baseBackoffMs: 321,
            jitterRatio: 0,
            maxBackoffMs: 321,
            onFlushFailure,
          },
        },
      })
      rs.spyOn(core.api.experience, 'upsertProfile').mockRejectedValue(new Error('experience-down'))

      core.setOnlineState(false)
      await core.track({ event: 'e1' })
      await core.track({ event: 'e2' })
      await core.track({ event: 'e3' })

      expect(onDrop).toHaveBeenCalledTimes(1)
      expect(onDrop).toHaveBeenCalledWith(
        expect.objectContaining({
          droppedCount: 1,
          maxEvents: 2,
          queuedEvents: 2,
        }),
      )

      core.setOnlineState(true)
      await core.flush()

      expect(onFlushFailure).toHaveBeenCalledTimes(1)
      expect(onFlushFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          consecutiveFailures: 1,
          queuedBatches: 1,
          queuedEvents: 2,
          retryDelayMs: 321,
        }),
      )
    } finally {
      rs.clearAllTimers()
      rs.useRealTimers()
    }
  })

  it('supports only one stateful instance per runtime until destroy is called', () => {
    const first = createCoreStateful()
    const createSecondCore = (): CoreStateful => new CoreStateful(config)

    expect(createSecondCore).toThrowError(/already initialized/i)

    first.destroy()

    expect(() => {
      createCoreStateful()
    }).not.toThrow()
  })

  it('flushes insights and Experience queues with force on destroy', async () => {
    const core = createCoreStatefulHarness({
      defaults: {
        consent: true,
        profile: profileFixture,
      },
    })
    const sendBatchEvents = rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
    const upsertProfile = rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue({
      changes: [],
      selectedPersonalizations: [],
      profile: profileFixture,
    })

    core.setOnlineState(false)
    await core.trackClick({ componentId: 'hero-banner' })
    await core.track({ event: 'queued-experience-event' })

    core.destroy()
    await Promise.resolve()
    await Promise.resolve()

    expect(sendBatchEvents).toHaveBeenCalledTimes(1)
    expect(upsertProfile).toHaveBeenCalledTimes(1)
  })

  it('exposes online state through protected accessor pair', () => {
    const core = createCoreStatefulHarness()

    expect(core.getOnlineState()).toBe(true)

    core.setOnlineState(false)

    expect(core.getOnlineState()).toBe(false)
    expect(signals.online.value).toBe(false)
  })

  it('returns false when online signal is undefined', () => {
    const core = createCoreStatefulHarness()

    signals.online.value = undefined

    expect(core.getOnlineState()).toBe(false)
  })

  it('exposes a stable states object across repeated reads', () => {
    const core = createCoreStateful()
    const firstStates = core.states
    const secondStates = core.states

    expect(secondStates).toBe(firstStates)
    expect(secondStates.blockedEventStream).toBe(firstStates.blockedEventStream)
    expect(secondStates.flag).toBe(firstStates.flag)
    expect(secondStates.consent).toBe(firstStates.consent)
    expect(secondStates.eventStream).toBe(firstStates.eventStream)
    expect(secondStates.canPersonalize).toBe(firstStates.canPersonalize)
    expect(secondStates.selectedPersonalizations).toBe(firstStates.selectedPersonalizations)
    expect(secondStates.previewPanelAttached).toBe(firstStates.previewPanelAttached)
    expect(secondStates.previewPanelOpen).toBe(firstStates.previewPanelOpen)
    expect(secondStates.profile).toBe(firstStates.profile)
  })

  it('exposes canPersonalize as a derived observable from personalizations', () => {
    const core = createCoreStateful()
    const values: boolean[] = []
    const subscription = core.states.canPersonalize.subscribe((value) => {
      values.push(value)
    })

    signals.selectedPersonalizations.value = []
    signals.selectedPersonalizations.value = undefined

    expect(values).toEqual([false, true, false])

    subscription.unsubscribe()
  })

  it('defaults personalizeEntry to the selectedPersonalizations signal', () => {
    const core = createCoreStateful()

    signals.selectedPersonalizations.value = selectedPersonalizationsFixture

    const result = core.personalizeEntry(personalizedEntry)

    expect(result.entry.sys.id).toBe('4k6ZyFQnR2POY5IJLLlJRb')
    expect(result.personalization).toEqual(
      expect.objectContaining({
        experienceId: '2qVK4T5lnScbswoyBuGipd',
        variantIndex: 1,
      }),
    )
  })

  it('defaults getMergeTagValue to the profile signal', () => {
    const core = createCoreStateful()

    signals.profile.value = profileFixture

    expect(core.getMergeTagValue(mergeTagEntry)).toBe('EU')
  })

  it('auto-tracks getFlag retrievals in stateful environments', () => {
    const core = createCoreStateful({
      defaults: {
        consent: true,
        profile: profileFixture,
      },
    })
    const trackFlagView = rs.spyOn(core, 'trackFlagView').mockResolvedValue(undefined)

    batch(() => {
      signals.changes.value = FLAG_CHANGES
    })

    expect(core.getFlag('dark-mode')).toBe(true)
    expect(trackFlagView).toHaveBeenCalledTimes(1)
    expect(trackFlagView).toHaveBeenCalledWith({
      componentId: 'dark-mode',
      experienceId: 'experience-id',
      variantIndex: 0,
    })
  })

  it('exposes key-scoped flag observables and tracks distinct value retrievals', () => {
    const core = createCoreStateful({
      defaults: {
        consent: true,
        profile: profileFixture,
      },
    })
    const trackFlagView = rs.spyOn(core, 'trackFlagView').mockResolvedValue(undefined)
    const values: Array<boolean | undefined> = []
    const flag = core.states.flag('dark-mode')
    const subscription = flag.subscribe((value) => {
      values.push(value === undefined ? undefined : Boolean(value))
    })

    batch(() => {
      signals.changes.value = FLAG_CHANGES
    })

    batch(() => {
      signals.changes.value = [
        ...FLAG_CHANGES,
        {
          key: 'new-flag',
          type: 'Variable',
          value: 'x',
          meta: {
            experienceId: 'experience-id',
            variantIndex: 2,
          },
        },
      ]
    })

    batch(() => {
      signals.changes.value = [
        {
          ...DARK_MODE_CHANGE,
          value: false,
        },
        OTHER_FLAG_CHANGE,
      ]
    })

    expect(values).toEqual([undefined, true, false])
    expect(trackFlagView).toHaveBeenCalledTimes(3)
    expect(trackFlagView).toHaveBeenNthCalledWith(1, { componentId: 'dark-mode' })
    expect(trackFlagView).toHaveBeenNthCalledWith(2, {
      componentId: 'dark-mode',
      experienceId: 'experience-id',
      variantIndex: 0,
    })
    expect(trackFlagView).toHaveBeenNthCalledWith(3, {
      componentId: 'dark-mode',
      experienceId: 'experience-id',
      variantIndex: 0,
    })

    subscription.unsubscribe()
  })

  it('exposes preview panel states and preserves them on reset', () => {
    const core = createCoreStateful()
    const attachedValues: boolean[] = []
    const openValues: boolean[] = []
    const attachedSubscription = core.states.previewPanelAttached.subscribe((value) => {
      attachedValues.push(value)
    })
    const openSubscription = core.states.previewPanelOpen.subscribe((value) => {
      openValues.push(value)
    })

    signals.previewPanelAttached.value = true
    signals.previewPanelOpen.value = true

    core.reset()

    expect(signals.previewPanelAttached.value).toBe(true)
    expect(signals.previewPanelOpen.value).toBe(true)
    expect(attachedValues).toEqual([false, true])
    expect(openValues).toEqual([false, true])

    attachedSubscription.unsubscribe()
    openSubscription.unsubscribe()
  })

  it('registers preview bridge values on symbol keys', () => {
    const core = createCoreStateful()
    const previewBridge: PreviewPanelSignalObject = {}

    core.registerPreviewPanel(previewBridge)

    expect(previewBridge[PREVIEW_PANEL_SIGNALS_SYMBOL]).toBe(signals)
    expect(previewBridge[PREVIEW_PANEL_SIGNAL_FNS_SYMBOL]).toBe(signalFns)
  })
})

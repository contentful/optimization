import type { ExperienceEventArray, OptimizationData } from './api-schemas'
import type { LifecycleInterceptors } from './CoreBase'
import CoreStateful, { type CoreStatefulConfig } from './CoreStateful'
import { EventBuilder, type EventEmissionResult } from './events'
import { signals } from './signals'
import { profile } from './test/fixtures/profile'

const DATA: OptimizationData = { profile, changes: [], selectedOptimizations: [] }
const builder = new EventBuilder({ channel: 'server', library: { name: 'test', version: '1' } })
const batch = (): ExperienceEventArray => [
  builder.buildIdentify({ userId: 'customer' }),
  builder.buildTrack({ event: 'campaign' }),
  builder.buildPageView(),
]

class PairedCore extends CoreStateful {
  async commit(
    events: ExperienceEventArray,
    profileId?: string,
    locale?: string,
  ): Promise<EventEmissionResult> {
    return await this.sendPreparedExperienceEvents(events, profileId, locale)
  }

  setOnline(value: boolean): void {
    this.online = value
  }
}

let core: PairedCore | undefined
function initialize(options: Partial<CoreStatefulConfig> = {}): PairedCore {
  core = new PairedCore({ spaceId: 'key_123', defaults: { consent: true }, ...options })
  rs.spyOn(core.api.experience, 'upsertProfile').mockResolvedValue(DATA)
  rs.spyOn(core.api.insights, 'sendBatchEvents').mockResolvedValue(true)
  return core
}

describe('prepared Core delivery', () => {
  beforeEach(() => {
    rs.useFakeTimers()
    signals.online.value = true
    signals.profile.value = undefined
  })
  afterEach(() => {
    core?.consent(false)
    core?.destroy()
    core = undefined
    rs.clearAllTimers()
    rs.useRealTimers()
  })

  it('commits one batch without rerunning event transformations', async () => {
    const runtime = initialize()
    const intercept = rs.fn<Parameters<LifecycleInterceptors['event']['add']>[0]>((event) => event)
    runtime.interceptors.event.add(intercept)
    const events = batch()
    const result = await runtime.commit(events, 'continuation', 'de-DE')
    expect(result).toEqual({ accepted: true })
    await rs.advanceTimersByTimeAsync(0)
    expect(runtime.api.experience.upsertProfile).toHaveBeenCalledTimes(1)
    expect(runtime.api.experience.upsertProfile).toHaveBeenCalledWith(
      {
        profileId: 'continuation',
        events: events.map((event) => ({
          ...event,
          context: { ...event.context, gdpr: { isConsentGiven: true } },
        })),
      },
      { preflight: false, locale: 'de-DE' },
    )
    expect(intercept).not.toHaveBeenCalled()
    expect(runtime.states.profile.current).toEqual(profile)
  })

  it('retains an ambiguous first failure and retries the same events/identity/locale under backoff', async () => {
    const runtime = initialize({
      queuePolicy: { flush: { baseBackoffMs: 50, maxBackoffMs: 50, jitterRatio: 0 } },
    })
    const upsert = rs
      .spyOn(runtime.api.experience, 'upsertProfile')
      .mockRejectedValueOnce(new Error('lost response'))
      .mockResolvedValue(DATA)
    const events = batch()
    await expect(runtime.commit(events, 'continuation', 'de-DE')).resolves.toEqual({
      accepted: true,
    })
    runtime.setLocale('fr-FR')
    await rs.advanceTimersByTimeAsync(50)
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert.mock.calls[1]).toEqual(upsert.mock.calls[0])
    expect(runtime.states.profile.current).toEqual(profile)
  })

  it('retains distinct offline batches without mixing or losing their page-bearing prefixes', async () => {
    const runtime = initialize()
    runtime.setOnline(false)
    const first = batch()
    const second = batch()
    await expect(runtime.commit(first)).resolves.toEqual({ accepted: true })
    await expect(runtime.commit(second)).resolves.toEqual({ accepted: true })
    expect(runtime.api.experience.upsertProfile).not.toHaveBeenCalled()
    runtime.setOnline(true)
    await rs.advanceTimersByTimeAsync(0)
    expect(runtime.api.experience.upsertProfile).toHaveBeenCalledTimes(2)
    const calls = rs.mocked(runtime.api.experience.upsertProfile).mock.calls
    expect(calls.map(([payload]) => payload.events.map(({ messageId }) => messageId))).toEqual([
      first.map(({ messageId }) => messageId),
      second.map(({ messageId }) => messageId),
    ])
  })

  it('rejects a whole batch at capacity and never admits a truncated prefix', async () => {
    const runtime = initialize({ queuePolicy: { offlineMaxEvents: 4 } })
    runtime.setOnline(false)
    await runtime.commit(batch())
    await expect(runtime.commit(batch())).resolves.toEqual({ accepted: false })
    runtime.setOnline(true)
    await rs.advanceTimersByTimeAsync(0)
    expect(runtime.api.experience.upsertProfile).toHaveBeenCalledTimes(1)
  })

  it('drains a distinct handoff admitted while the earlier delivery is pending', async () => {
    const runtime = initialize()
    let finish: ((value: OptimizationData) => void) | undefined
    const upsert = rs
      .spyOn(runtime.api.experience, 'upsertProfile')
      .mockImplementationOnce(
        async () =>
          await new Promise<OptimizationData>((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValue(DATA)
    const first = batch()
    const second = batch()
    const pending = runtime.commit(first)
    await expect(runtime.commit(second)).resolves.toEqual({ accepted: true })
    expect(upsert).toHaveBeenCalledTimes(1)
    finish?.(DATA)
    await pending
    await rs.advanceTimersByTimeAsync(0)
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(
      upsert.mock.calls.map(([payload]) => payload.events.map(({ messageId }) => messageId)),
    ).toEqual([first.map(({ messageId }) => messageId), second.map(({ messageId }) => messageId)])
  })

  it('reevaluates current consent before admission, without freezing a denied attempt', async () => {
    const runtime = initialize({ defaults: { consent: false } })
    const events = batch()
    await expect(runtime.commit(events)).resolves.toEqual({ accepted: false })
    expect(runtime.api.experience.upsertProfile).not.toHaveBeenCalled()
    runtime.consent({ events: true, persistence: false })
    await expect(runtime.commit(events)).resolves.toMatchObject({ accepted: true })
    expect(runtime.states.persistenceConsent.current).toBe(false)
  })

  it('does not restore profile state after reset while a response interceptor is pending', async () => {
    const runtime = initialize()
    let release: (() => void) | undefined
    let started: (() => void) | undefined
    const intercepted = new Promise<void>((resolve) => {
      started = resolve
    })
    runtime.interceptors.state.add(async (state) => {
      started?.()
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return state
    })
    const delivery = runtime.commit(batch())
    await intercepted
    runtime.reset()
    release?.()
    await delivery
    await rs.advanceTimersByTimeAsync(0)
    expect(runtime.states.profile.current).toBeUndefined()
    expect(runtime.states.experienceRequestState.current).toEqual({ status: 'idle' })
  })

  it('ignores a pre-reset API response without replacing state established after reset', async () => {
    const runtime = initialize()
    let finish: ((value: OptimizationData) => void) | undefined
    rs.spyOn(runtime.api.experience, 'upsertProfile')
      .mockImplementationOnce(
        async () =>
          await new Promise<OptimizationData>((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValueOnce({ ...DATA, profile: { ...profile, traits: { current: true } } })
    const pending = runtime.commit(batch())
    runtime.reset()
    await runtime.page()
    finish?.(DATA)
    await expect(pending).resolves.toEqual({ accepted: true })
    await rs.advanceTimersByTimeAsync(0)
    expect(runtime.states.profile.current?.traits).toEqual({ current: true })
  })

  it('does not publish or schedule queue retries for an in-flight failure after reset', async () => {
    const runtime = initialize()
    let fail: ((error: Error) => void) | undefined
    const upsert = rs.spyOn(runtime.api.experience, 'upsertProfile').mockImplementationOnce(
      async () =>
        await new Promise<OptimizationData>((_resolve, reject) => {
          fail = reject
        }),
    )
    const pending = runtime.commit(batch())
    runtime.reset()
    fail?.(new Error('old request failed'))
    await expect(pending).resolves.toEqual({ accepted: true })
    await rs.advanceTimersByTimeAsync(10_000)
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(runtime.states.profile.current).toBeUndefined()
    expect(runtime.states.experienceRequestState.current).toEqual({ status: 'idle' })
  })

  it('commits an ID-less replay through the API and uses the returned ID for the next batch', async () => {
    const runtime = initialize()
    runtime.setOnline(false)
    const first = batch()
    const second = batch()
    await runtime.commit(first)
    await runtime.commit(second)
    runtime.setOnline(true)
    await rs.advanceTimersByTimeAsync(0)
    const calls = rs.mocked(runtime.api.experience.upsertProfile).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0]?.[0].profileId).toBeUndefined()
    expect(calls[1]?.[0].profileId).toBe(DATA.profile.id)
    expect(calls.map(([payload]) => payload.events.map(({ messageId }) => messageId))).toEqual([
      first.map(({ messageId }) => messageId),
      second.map(({ messageId }) => messageId),
    ])
    expect(runtime.states.profile.current).toEqual(DATA.profile)
  })

  it('keeps current Insights work intact when a pre-reset flush completes', async () => {
    const runtime = initialize({ getAnonymousId: () => profile.id })
    let finishOld: ((value: boolean) => void) | undefined
    let finishNew: ((value: boolean) => void) | undefined
    const insights = rs
      .spyOn(runtime.api.insights, 'sendBatchEvents')
      .mockImplementationOnce(
        async () =>
          await new Promise<boolean>((resolve) => {
            finishOld = resolve
          }),
      )
      .mockImplementationOnce(
        async () =>
          await new Promise<boolean>((resolve) => {
            finishNew = resolve
          }),
      )
    await runtime.trackClick({ componentId: 'before-reset' })
    const oldFlush = runtime.flush()
    runtime.reset()
    await runtime.trackClick({ componentId: 'after-reset' })
    const newFlush = runtime.flush()
    finishOld?.(true)
    await oldFlush
    await runtime.flush()
    expect(insights).toHaveBeenCalledTimes(2)
    finishNew?.(true)
    await newFlush
    await runtime.flush()
    expect(insights).toHaveBeenCalledTimes(2)
    expect(insights.mock.calls[1]?.[0][0]?.events).toMatchObject([{ componentId: 'after-reset' }])
  })

  it('retains an ordinary event admitted at capacity while an earlier flush is pending', async () => {
    const runtime = initialize({ queuePolicy: { offlineMaxEvents: 2 } })
    let finish: ((value: OptimizationData) => void) | undefined
    const upsert = rs
      .spyOn(runtime.api.experience, 'upsertProfile')
      .mockImplementationOnce(
        async () =>
          await new Promise<OptimizationData>((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValue(DATA)
    runtime.setOnline(false)
    await runtime.track({ event: 'first' })
    await runtime.track({ event: 'second' })
    runtime.setOnline(true)
    runtime.setOnline(false)
    await runtime.track({ event: 'third' })
    finish?.(DATA)
    await rs.advanceTimersByTimeAsync(0)
    expect(
      upsert.mock.calls
        .flatMap(([payload]) => payload.events)
        .filter((event) => event.type === 'track')
        .map((event) => event.event),
    ).toEqual(['first', 'second', 'third'])
  })

  it('queues early Insights interactions using known continuity and retains interactions admitted during flush', async () => {
    const runtime = initialize({ getAnonymousId: () => 'continuation' })
    let finish: ((value: boolean) => void) | undefined
    const insights = rs
      .spyOn(runtime.api.insights, 'sendBatchEvents')
      .mockImplementationOnce(
        async () =>
          await new Promise<boolean>((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValue(true)
    await runtime.trackClick({
      componentId: 'displayed-entry',
      experienceId: 'experience',
      variantIndex: 1,
    })
    const flushing = runtime.flush()
    await runtime.trackClick({ componentId: 'second-entry' })
    finish?.(true)
    await flushing
    await runtime.flush()
    expect(insights).toHaveBeenCalledTimes(2)
    expect(insights.mock.calls[0]?.[0][0]).toMatchObject({
      profile: { id: 'continuation' },
      events: [{ componentId: 'displayed-entry', experienceId: 'experience', variantIndex: 1 }],
    })
    expect(insights.mock.calls[1]?.[0][0]).toMatchObject({
      profile: { id: 'continuation' },
      events: [{ componentId: 'second-entry' }],
    })
    expect(runtime.states.profile.current).toBeUndefined()
  })
})

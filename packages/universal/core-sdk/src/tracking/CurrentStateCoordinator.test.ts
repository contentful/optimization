import { describe, expect, it, rs } from '@rstest/core'
import type { EventEmissionResult } from '../events'
import { CurrentStateCoordinator } from './CurrentStateCoordinator'

const createCoordinator = (): {
  coordinator: CurrentStateCoordinator
  invalidateExperienceRequests: ReturnType<typeof rs.fn>
} => {
  const invalidateExperienceRequests = rs.fn()
  const coordinator = new CurrentStateCoordinator({ invalidateExperienceRequests })
  coordinator.reset()

  return { coordinator, invalidateExperienceRequests }
}

describe('CurrentStateCoordinator', () => {
  it('joins a pending same-key attempt', async () => {
    const { coordinator } = createCoordinator()
    const pending = Promise.withResolvers<EventEmissionResult>()
    const emit = rs.fn().mockReturnValue(pending.promise)

    const first = coordinator.emitIfNeeded({ key: 'home', isAllowed: true, emit })
    const joined = coordinator.emitIfNeeded({ key: 'home', isAllowed: false, emit })

    pending.resolve({ accepted: true })

    await expect(first).resolves.toEqual({ accepted: true })
    await expect(joined).resolves.toEqual({ accepted: true })
    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('does not advance an already accepted same key', () => {
    const { coordinator, invalidateExperienceRequests } = createCoordinator()

    expect(coordinator.markAccepted('home')).toEqual({ accepted: true })
    const accepted = coordinator.signal.value
    invalidateExperienceRequests.mockClear()

    expect(coordinator.markAccepted('home')).toEqual({
      accepted: false,
      reason: 'already-accepted',
    })
    expect(coordinator.signal.value).toBe(accepted)
    expect(invalidateExperienceRequests).not.toHaveBeenCalled()
  })

  it('maps a current nonacceptance to not-allowed and leaves the key retryable', async () => {
    const { coordinator } = createCoordinator()
    const emit = rs
      .fn()
      .mockResolvedValueOnce({ accepted: false })
      .mockResolvedValueOnce({ accepted: true })

    await expect(coordinator.emitIfNeeded({ key: 'home', isAllowed: true, emit })).resolves.toEqual(
      { accepted: false, reason: 'not-allowed' },
    )
    expect(coordinator.signal.value).toMatchObject({ key: 'home', status: 'observed' })

    await expect(coordinator.emitIfNeeded({ key: 'home', isAllowed: true, emit })).resolves.toEqual(
      { accepted: true },
    )
  })

  it('keeps only A2 current for A1 -> B -> A2', async () => {
    const { coordinator } = createCoordinator()
    const a1Emission = Promise.withResolvers<EventEmissionResult>()
    const bEmission = Promise.withResolvers<EventEmissionResult>()
    const a2Emission = Promise.withResolvers<EventEmissionResult>()

    const a1 = coordinator.emitIfNeeded({
      key: 'a',
      isAllowed: true,
      emit: async () => await a1Emission.promise,
    })
    const b = coordinator.emitIfNeeded({
      key: 'b',
      isAllowed: true,
      emit: async () => await bEmission.promise,
    })
    const a2 = coordinator.emitIfNeeded({
      key: 'a',
      isAllowed: true,
      emit: async () => await a2Emission.promise,
    })

    a2Emission.resolve({ accepted: true })
    a1Emission.resolve({ accepted: true })
    bEmission.resolve({ accepted: true })

    await expect(a1).resolves.toEqual({ accepted: false, reason: 'superseded' })
    await expect(b).resolves.toEqual({ accepted: false, reason: 'superseded' })
    await expect(a2).resolves.toEqual({ accepted: true })
    expect(coordinator.signal.value).toMatchObject({ key: 'a', status: 'accepted' })
  })

  it('broadly invalidates Experience ownership when a new key is observed', async () => {
    const { coordinator, invalidateExperienceRequests } = createCoordinator()
    const pending = Promise.withResolvers<EventEmissionResult>()
    const first = coordinator.emitIfNeeded({
      key: 'a',
      isAllowed: true,
      emit: async () => await pending.promise,
    })
    invalidateExperienceRequests.mockClear()

    await expect(
      coordinator.emitIfNeeded({ key: 'b', isAllowed: false, emit: rs.fn() }),
    ).resolves.toEqual({ accepted: false, reason: 'not-allowed' })

    pending.resolve({ accepted: true })

    await expect(first).resolves.toEqual({ accepted: false, reason: 'superseded' })
    expect(invalidateExperienceRequests).toHaveBeenCalledTimes(1)
    expect(coordinator.signal.value).toMatchObject({ key: 'b', status: 'observed' })
  })
})

import { signal } from '@preact/signals-core'
import type { EventEmissionResult } from '../events'
import type { CurrentStateTrackingResult, CurrentStateTrackingState } from './CurrentStateTracking'

interface CurrentStateAttempt {
  readonly generation: number
  readonly key: string
  promise: Promise<CurrentStateTrackingResult> | undefined
}

interface CurrentStateEmissionOptions {
  readonly emit: (generation: number) => Promise<EventEmissionResult>
  readonly isAllowed: boolean
  readonly key: string
}

interface CurrentStateCoordinatorOptions {
  readonly invalidateExperienceRequests: () => void
}

const currentStateTrackingSignal = signal<CurrentStateTrackingState>({
  generation: 0,
  status: 'idle',
})

/** @internal */
export class CurrentStateCoordinator {
  private readonly invalidateExperienceRequests: CurrentStateCoordinatorOptions['invalidateExperienceRequests']
  private currentAttempt: CurrentStateAttempt | undefined
  readonly signal = currentStateTrackingSignal

  constructor({ invalidateExperienceRequests }: CurrentStateCoordinatorOptions) {
    this.invalidateExperienceRequests = invalidateExperienceRequests
  }

  async emitIfNeeded({
    emit,
    isAllowed,
    key,
  }: CurrentStateEmissionOptions): Promise<CurrentStateTrackingResult> {
    const { value: current } = currentStateTrackingSignal

    if (current.status !== 'idle' && current.key === key) {
      if (current.status === 'accepted') {
        return { accepted: false, reason: 'already-accepted' }
      }

      if (current.status === 'pending') {
        const { currentAttempt: attempt } = this
        if (
          attempt?.generation === current.generation &&
          attempt.key === key &&
          attempt.promise !== undefined
        ) {
          return await attempt.promise
        }
      }
    } else {
      this.advance({ key, status: 'observed' })
    }

    const {
      value: { generation },
    } = currentStateTrackingSignal
    if (!isAllowed) {
      return { accepted: false, reason: 'not-allowed' }
    }

    currentStateTrackingSignal.value = { generation, key, status: 'pending' }
    const attempt: CurrentStateAttempt = { generation, key, promise: undefined }
    this.currentAttempt = attempt
    attempt.promise = this.runAttempt(attempt, emit)

    return await attempt.promise
  }

  markAccepted(key: string): CurrentStateTrackingResult {
    const { value: current } = currentStateTrackingSignal
    if (current.status === 'accepted' && current.key === key) {
      return { accepted: false, reason: 'already-accepted' }
    }

    this.advance({ key, status: 'accepted' })
    return { accepted: true }
  }

  reset(): void {
    this.advance({ status: 'idle' })
  }

  private async runAttempt(
    attempt: CurrentStateAttempt,
    emit: CurrentStateEmissionOptions['emit'],
  ): Promise<CurrentStateTrackingResult> {
    try {
      const result = await emit(attempt.generation)
      if (!this.isCurrent(attempt)) return { accepted: false, reason: 'superseded' }

      this.currentAttempt = undefined
      if (!result.accepted) {
        currentStateTrackingSignal.value = {
          generation: attempt.generation,
          key: attempt.key,
          status: 'observed',
        }
        return { accepted: false, reason: 'not-allowed' }
      }

      currentStateTrackingSignal.value = {
        generation: attempt.generation,
        key: attempt.key,
        status: 'accepted',
      }
      return result.data === undefined ? { accepted: true } : { accepted: true, data: result.data }
    } catch (error: unknown) {
      if (!this.isCurrent(attempt)) return { accepted: false, reason: 'superseded' }

      this.currentAttempt = undefined
      currentStateTrackingSignal.value = {
        generation: attempt.generation,
        key: attempt.key,
        status: 'observed',
      }
      throw error
    }
  }

  private isCurrent(attempt: CurrentStateAttempt): boolean {
    const { value: current } = currentStateTrackingSignal
    return (
      this.currentAttempt === attempt &&
      current.generation === attempt.generation &&
      current.status === 'pending'
    )
  }

  private advance(
    state:
      | { readonly key: string; readonly status: 'observed' | 'accepted' }
      | { readonly status: 'idle' },
  ): void {
    const generation = currentStateTrackingSignal.value.generation + 1
    this.currentAttempt = undefined
    this.invalidateExperienceRequests()
    currentStateTrackingSignal.value = { generation, ...state }
  }
}

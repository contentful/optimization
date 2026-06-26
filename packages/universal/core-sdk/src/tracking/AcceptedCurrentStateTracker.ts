import type { EventEmissionResult } from '../events'

/**
 * Options for {@link AcceptedCurrentStateTracker}.
 *
 * @public
 */
export interface AcceptedCurrentStateTrackerOptions<TKey> {
  readonly isEqual?: (left: TKey, right: TKey) => boolean
}

/**
 * Emission inputs for {@link AcceptedCurrentStateTracker.emitIfNeeded}.
 *
 * @public
 */
export interface AcceptedCurrentStateEmissionOptions<TKey, TData> {
  readonly key: TKey
  readonly isAllowed: boolean
  readonly emit: () => Promise<EventEmissionResult<TData>>
}

/**
 * Result returned by {@link AcceptedCurrentStateTracker.emitIfNeeded}.
 *
 * @public
 */
export type AcceptedCurrentStateEmissionResult<TData> = EventEmissionResult<TData> & {
  readonly attempted: boolean
}

/**
 * Tracks accepted emissions for current-state SDK adapters such as the active
 * page or screen.
 *
 * @public
 */
export class AcceptedCurrentStateTracker<TKey> {
  private readonly isEqual: (left: TKey, right: TKey) => boolean
  private accepted: { key: TKey } | undefined
  private inFlight: { key: TKey } | undefined

  constructor(options: AcceptedCurrentStateTrackerOptions<TKey> = {}) {
    this.isEqual = options.isEqual ?? Object.is
  }

  hasAccepted(): boolean {
    return this.accepted !== undefined
  }

  markAccepted(key: TKey): void {
    this.accepted = { key }
  }

  reset(): void {
    this.accepted = undefined
    this.inFlight = undefined
  }

  async emitIfNeeded<TData>({
    key,
    isAllowed,
    emit,
  }: AcceptedCurrentStateEmissionOptions<TKey, TData>): Promise<
    AcceptedCurrentStateEmissionResult<TData>
  > {
    if (!isAllowed || this.matches(this.accepted, key) || this.matches(this.inFlight, key)) {
      return { accepted: false, attempted: false }
    }

    this.inFlight = { key }

    try {
      const result = await emit()
      if (result.accepted && this.matches(this.inFlight, key)) {
        this.markAccepted(key)
      }

      return { ...result, attempted: true }
    } finally {
      if (this.matches(this.inFlight, key)) {
        this.inFlight = undefined
      }
    }
  }

  private matches(state: { key: TKey } | undefined, key: TKey): boolean {
    return state !== undefined && this.isEqual(state.key, key)
  }
}

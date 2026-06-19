import type { EventEmissionResult } from '../EventEmissionResult'

export interface AcceptedCurrentStateTrackerOptions<TKey> {
  readonly isEqual?: (left: TKey, right: TKey) => boolean
}

export interface AcceptedCurrentStateEmissionOptions<TKey, TData> {
  readonly key: TKey
  readonly isAllowed: boolean
  readonly emit: () => Promise<EventEmissionResult<TData>>
}

export interface AcceptedCurrentStateEmissionResult<TData> extends EventEmissionResult<TData> {
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

  shouldTrack(key: TKey, isAllowed: boolean): boolean {
    return isAllowed && !this.matchesAcceptedKey(key) && !this.matchesInFlightKey(key)
  }

  markInFlight(key: TKey): void {
    this.inFlight = { key }
  }

  markAccepted(key: TKey): void {
    this.accepted = { key }
  }

  clearInFlight(key: TKey): void {
    if (this.matchesInFlightKey(key)) {
      this.inFlight = undefined
    }
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
    if (!this.shouldTrack(key, isAllowed)) {
      return { accepted: false, attempted: false }
    }

    this.markInFlight(key)

    try {
      const result = await emit()
      if (result.accepted && this.matchesInFlightKey(key)) {
        this.markAccepted(key)
      }

      return { ...result, attempted: true }
    } finally {
      this.clearInFlight(key)
    }
  }

  private matchesAcceptedKey(key: TKey): boolean {
    return this.accepted !== undefined && this.isEqual(this.accepted.key, key)
  }

  private matchesInFlightKey(key: TKey): boolean {
    return this.inFlight !== undefined && this.isEqual(this.inFlight.key, key)
  }
}

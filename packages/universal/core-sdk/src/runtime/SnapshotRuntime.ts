import type {
  ChangeArray,
  Json,
  MergeTagEntry,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import { hasEventConsent, UNLOCKING_EVENT_TYPES } from '../consent/ConsentPolicy'
import type { CoreStates } from '../CoreStateful'
import type { EventEmissionResult } from '../events/EventEmissionResult'
import { type AllowedEventType, DEFAULT_ALLOWED_EVENT_TYPES } from '../events/EventType'
import type { OptimizationSelectionState } from '../handoff'
import FlagsResolver from '../resolvers/FlagsResolver'
import MergeTagValueResolver from '../resolvers/MergeTagValueResolver'
import type { ResolvedData } from '../resolvers/OptimizedEntryResolver'
import OptimizedEntryResolver from '../resolvers/OptimizedEntryResolver'
import { staticObservable } from '../signals'
import type { OptimizationRuntime } from './OptimizationRuntime'

const logger = createScopedLogger('Optimization:SnapshotRuntime')

/**
 * Read-only optimization state used to create a snapshot runtime.
 *
 * @public
 */
export interface OptimizationSnapshot {
  /** Optimization state used by a server-side, static, or edge render. */
  readonly data?: OptimizationSelectionState
  /** Tracking consent for the current request or render. */
  readonly consent?: boolean
  /** Persistence consent for the current request or render. */
  readonly persistenceConsent?: boolean
  /** Locale used to resolve localized flags and entries. */
  readonly locale?: string
  /** Event types allowed to affect optimization behavior without full consent. */
  readonly allowedEventTypes?: readonly AllowedEventType[]
}

const INERT_ACTION_WARNING =
  'Optimization action called on the server (read-only runtime); it is a no-op.'

const ACCEPTED_NOOP_RESULT: EventEmissionResult = { accepted: false }

/**
 * Read-only runtime backed by an immutable optimization snapshot.
 *
 * @public
 */
class SnapshotRuntime implements OptimizationRuntime {
  private readonly snapshot: OptimizationSnapshot
  private readonly changes: ChangeArray | undefined
  private readonly currentSelectedOptimizations: SelectedOptimizationArray | undefined
  private readonly currentProfile: Profile | undefined
  private readonly allowedEventTypes: readonly AllowedEventType[]

  /** Static observable state derived from the snapshot. */
  readonly states: CoreStates

  constructor(snapshot: OptimizationSnapshot = {}) {
    this.snapshot = snapshot
    this.changes = snapshot.data?.changes
    this.currentSelectedOptimizations = snapshot.data?.selectedOptimizations
    this.currentProfile = snapshot.data?.profile
    this.allowedEventTypes = snapshot.allowedEventTypes ?? DEFAULT_ALLOWED_EVENT_TYPES

    this.states = {
      blockedEventStream: staticObservable(undefined),
      consent: staticObservable(snapshot.consent),
      persistenceConsent: staticObservable(snapshot.persistenceConsent ?? snapshot.consent),
      eventStream: staticObservable(undefined),
      locale: staticObservable(snapshot.locale),
      canOptimize: staticObservable(this.currentSelectedOptimizations !== undefined),
      optimizationPossible: staticObservable(
        snapshot.consent === true ||
          UNLOCKING_EVENT_TYPES.some((type) => this.allowedEventTypes.includes(type)),
      ),
      experienceRequestState: staticObservable({ status: 'success' }),
      selectedOptimizations: staticObservable(this.currentSelectedOptimizations),
      previewPanelAttached: staticObservable(false),
      previewPanelOpen: staticObservable(false),
      profile: staticObservable(this.currentProfile),
      flag: (name: string) => staticObservable<Json>(this.getFlag(name)),
    }
  }

  resolveOptimizedEntry<
    S extends EntrySkeletonType = EntrySkeletonType,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, undefined, L>,
    selectedOptimizations?: SelectedOptimizationArray,
  ): ResolvedData<S, undefined, L>
  resolveOptimizedEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(entry: Entry<S, M, L>, selectedOptimizations?: SelectedOptimizationArray): ResolvedData<S, M, L>
  resolveOptimizedEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, M, L>,
    selectedOptimizations?: SelectedOptimizationArray,
  ): ResolvedData<S, M, L> {
    return OptimizedEntryResolver.resolve<S, M, L>(
      entry,
      selectedOptimizations ?? this.currentSelectedOptimizations,
    )
  }

  getMergeTagValue(
    embeddedEntryNodeTarget: MergeTagEntry,
    profile: Profile | undefined = this.currentProfile,
  ): string | undefined {
    return MergeTagValueResolver.resolve(embeddedEntryNodeTarget, profile)
  }

  getFlag(name: string, changes: ChangeArray | undefined = this.changes): Json {
    return FlagsResolver.resolve(changes)[name]
  }

  get locale(): string | undefined {
    return this.snapshot.locale
  }

  hasConsent(name: string): boolean {
    return hasEventConsent(name, this.snapshot.consent, this.allowedEventTypes)
  }

  async identify(): Promise<EventEmissionResult> {
    return await Promise.resolve(this.inertEventEmission())
  }

  async page(): Promise<EventEmissionResult> {
    return await Promise.resolve(this.inertEventEmission())
  }

  async screen(): Promise<EventEmissionResult> {
    return await Promise.resolve(this.inertEventEmission())
  }

  async track(): Promise<EventEmissionResult> {
    return await Promise.resolve(this.inertEventEmission())
  }

  async trackView(): Promise<EventEmissionResult> {
    return await Promise.resolve(this.inertEventEmission())
  }

  async trackClick(): Promise<void> {
    this.warnInert()
    await Promise.resolve()
  }

  async trackHover(): Promise<void> {
    this.warnInert()
    await Promise.resolve()
  }

  async trackFlagView(): Promise<void> {
    this.warnInert()
    await Promise.resolve()
  }

  consent(): void {
    this.warnInert()
  }

  reset(): void {
    this.warnInert()
  }

  async flush(): Promise<void> {
    this.warnInert()
    await Promise.resolve()
  }

  setLocale(): string | undefined {
    this.warnInert()
    return this.snapshot.locale
  }

  destroy(): void {
    // Snapshot runtime owns no listeners, timers, or singletons.
  }

  private inertEventEmission(): EventEmissionResult {
    this.warnInert()
    return ACCEPTED_NOOP_RESULT
  }

  private warnInert(): void {
    logger.warn(INERT_ACTION_WARNING)
  }
}

/**
 * Create a read-only runtime from server-provided optimization state.
 *
 * @public
 */
export function createSnapshotRuntime(snapshot?: OptimizationSnapshot): OptimizationRuntime {
  return new SnapshotRuntime(snapshot)
}

export type { SnapshotRuntime }

import type {
  ChangeArray,
  Json,
  MergeTagEntry,
  OptimizationData,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import type { CoreStates } from '../CoreStateful'
import type { EventEmissionResult } from '../events'
import type { ResolvedData } from '../resolvers'
import { FlagsResolver, MergeTagValueResolver, OptimizedEntryResolver } from '../resolvers'
import { staticObservable } from '../signals'
import type { OptimizationRuntime } from './OptimizationRuntime'

const logger = createScopedLogger('Optimization:SnapshotRuntime')

/**
 * Request-scoped, read-only state used to seed a {@link SnapshotRuntime}.
 *
 * @remarks
 * Mirrors the serializable server-to-client handoff shape. `data` is the
 * resolved {@link OptimizationData} the server computed for the request;
 * `consent` and `locale` carry the request's policy so read hooks observe the
 * same values the live client SDK will report after hydration.
 *
 * @public
 */
export interface OptimizationSnapshot {
  /** Optimization data resolved server-side for the current request. */
  readonly data?: OptimizationData
  /** Event consent for the request, if known. */
  readonly consent?: boolean
  /** Profile-continuity persistence consent for the request, if known. */
  readonly persistenceConsent?: boolean
  /** Active locale for the request, if known. */
  readonly locale?: string
}

/**
 * Reason logged when an action method is invoked on the read-only runtime.
 *
 * @internal
 */
const INERT_ACTION_WARNING =
  'Optimization action called on the server (read-only runtime); it is a no-op. ' +
  'Actions such as identify/page/track only run in the browser after hydration.'

const ACCEPTED_NOOP_RESULT: EventEmissionResult = { accepted: false }

/**
 * A read-only {@link OptimizationRuntime} backed by a request-scoped snapshot.
 *
 * @remarks
 * Used during server-side rendering and the initial client render, before the
 * live stateful SDK exists. It satisfies the exact same interface the browser
 * SDK does, so a framework provider can render children from either backing
 * without branching on environment:
 *
 * - **Resolve** methods delegate to the shared static resolvers — identical
 *   behavior to the browser SDK, with no browser globals and no API client.
 * - **`states`** are static observables over the snapshot: `current` returns the
 *   snapshot value and `subscribe` emits it once and never changes, so
 *   `useSyncExternalStore` server snapshots stay stable.
 * - **Actions** are inert no-ops that warn in development. There is no request,
 *   queue, or user interaction to service on the server.
 *
 * Create instances with {@link createSnapshotRuntime}.
 *
 * @public
 */
class SnapshotRuntime implements OptimizationRuntime {
  private readonly snapshot: OptimizationSnapshot
  private readonly changes: ChangeArray | undefined
  private readonly currentSelectedOptimizations: SelectedOptimizationArray | undefined
  private readonly currentProfile: Profile | undefined

  readonly states: CoreStates

  constructor(snapshot: OptimizationSnapshot = {}) {
    this.snapshot = snapshot
    this.changes = snapshot.data?.changes
    this.currentSelectedOptimizations = snapshot.data?.selectedOptimizations
    this.currentProfile = snapshot.data?.profile

    const canOptimize = this.currentSelectedOptimizations !== undefined

    this.states = {
      blockedEventStream: staticObservable(undefined),
      consent: staticObservable(snapshot.consent),
      persistenceConsent: staticObservable(snapshot.persistenceConsent ?? snapshot.consent),
      eventStream: staticObservable(undefined),
      locale: staticObservable(snapshot.locale),
      canOptimize: staticObservable(canOptimize),
      optimizationPossible: staticObservable(true),
      experienceRequestState: staticObservable(
        snapshot.data ? { status: 'success' } : { status: 'idle' },
      ),
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

  hasConsent(): boolean {
    return this.snapshot.consent === true
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
    // No-op: the snapshot runtime owns no listeners, timers, or singletons.
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
 * Create a read-only {@link OptimizationRuntime} from a request-scoped snapshot.
 *
 * @param snapshot - Server-resolved optimization state for the current request.
 * @returns A runtime that resolves entries/merge tags/flags from the snapshot,
 *   exposes static state observables, and treats actions as no-ops.
 *
 * @example
 * ```ts
 * const runtime = createSnapshotRuntime({ data: serverOptimizationData, consent: true })
 * const { entry } = runtime.resolveOptimizedEntry(baselineEntry)
 * ```
 *
 * @public
 */
export function createSnapshotRuntime(snapshot?: OptimizationSnapshot): OptimizationRuntime {
  return new SnapshotRuntime(snapshot)
}

export type { SnapshotRuntime }

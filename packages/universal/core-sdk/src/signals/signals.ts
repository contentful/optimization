import type {
  InsightsEvent as AnalyticsEvent,
  ChangeArray,
  ExperienceEvent as OptimizationEvent,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { batch, computed, effect, signal, type Signal, untracked } from '@preact/signals-core'
import type { BlockedEvent } from '../events'

/**
 * Most recent optimization changes returned by the Experience API.
 *
 * @public
 */
export const changes: Signal<ChangeArray | undefined> = signal<ChangeArray | undefined>()

/**
 * Most recent blocked-event metadata produced by consent/runtime guards.
 *
 * @public
 */
export const blockedEvent: Signal<BlockedEvent | undefined> = signal<BlockedEvent | undefined>()

/**
 * Current optimization/analytics consent state.
 *
 * @public
 */
export const consent = signal<boolean | undefined>()

/**
 * Current durable profile-continuity persistence consent state.
 *
 * @public
 */
export const persistenceConsent = signal<boolean | undefined>()

/**
 * Most recent emitted optimization event.
 *
 * @public
 */
export const event: Signal<AnalyticsEvent | OptimizationEvent | undefined> = signal<
  AnalyticsEvent | OptimizationEvent | undefined
>()

/**
 * Resolved Contentful locale used by stateful SDK entry fetches and default Experience requests.
 *
 * @public
 */
export const locale: Signal<string | undefined> = signal<string | undefined>()

/**
 * Runtime online/offline signal used by queue flush logic.
 *
 * @defaultValue `true`
 * @public
 */
export const online = signal<boolean | undefined>(true)

/**
 * Indicates whether the preview panel bridge has been attached.
 *
 * @defaultValue `false`
 * @public
 */
export const previewPanelAttached = signal<boolean>(false)

/**
 * Indicates whether the preview panel is open.
 *
 * @defaultValue `false`
 * @public
 */
export const previewPanelOpen = signal<boolean>(false)

/**
 * Most recent selected optimization variants.
 *
 * @public
 */
export const selectedOptimizations = signal<SelectedOptimizationArray | undefined>()

/**
 * Whether optimization selection data is available for entry resolution.
 *
 * @public
 */
export const canOptimize = computed<boolean>(() => selectedOptimizations.value !== undefined)

/**
 * Active profile associated with current runtime state.
 *
 * @public
 */
export const profile: Signal<Profile | undefined> = signal<Profile | undefined>()

/**
 * Reason for an Experience API request to enter the `failed` state.
 *
 * - `timeout`: the request was aborted by the configured request timeout.
 * - `api-error`: the API responded with a non-success HTTP status or returned an unparseable body.
 *
 * @public
 */
export type ExperienceRequestFailureReason = 'timeout' | 'api-error'

/**
 * Outcome of the most recent Experience API request.
 *
 * Transitions: `idle` -> `pending` (request started) -> `success` | `failed`. Once a terminal state
 * is reached it stays there until the next request transitions back to `pending`.
 *
 * Consumers can subscribe to this state to fail-open to baseline rendering when the Experience API
 * cannot resolve optimization data (network failures, timeouts, 5xx).
 *
 * @public
 */
export type ExperienceRequestState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success' }
  | { status: 'failed'; reason: ExperienceRequestFailureReason }

/**
 * Outcome signal for the most recent Experience API request.
 *
 * Written exclusively by the `ExperienceQueue`; exposed read-only on `CoreStateful.states`.
 *
 * @public
 */
export const experienceRequestState: Signal<ExperienceRequestState> =
  signal<ExperienceRequestState>({ status: 'idle' })

/**
 * Collection of shared stateful Core signals.
 *
 * @public
 */
export interface Signals {
  /** Most recent blocked-event metadata. */
  blockedEvent: typeof blockedEvent
  /** Most recent optimization changes payload. */
  changes: typeof changes
  /** Current consent signal. */
  consent: typeof consent
  /** Most recent emitted event signal. */
  event: typeof event
  /** Resolved Contentful locale signal. */
  locale: typeof locale
  /** Runtime connectivity signal. */
  online: typeof online
  /** Preview panel attachment signal. */
  previewPanelAttached: typeof previewPanelAttached
  /** Preview panel open-state signal. */
  previewPanelOpen: typeof previewPanelOpen
  /** Durable profile-continuity persistence consent signal. */
  persistenceConsent: typeof persistenceConsent
  /** Selected optimization variants signal. */
  selectedOptimizations: typeof selectedOptimizations
  /** Whether optimization selection data is available. */
  canOptimize: typeof canOptimize
  /** Active profile signal. */
  profile: typeof profile
  /** Outcome of the most recent Experience API request. */
  experienceRequestState: typeof experienceRequestState
}

/**
 * Signal utility functions shared with preview tooling and extensions.
 *
 * @public
 */
export interface SignalFns {
  /** Execute multiple signal writes in one reactive batch. */
  batch: typeof batch
  /** Create a derived computed signal. */
  computed: typeof computed
  /** Register a reactive effect. */
  effect: typeof effect
  /** Read signal values without dependency tracking. */
  untracked: typeof untracked
}

/**
 * Pre-bundled reference to all shared signals.
 *
 * @public
 */
export const signals: Signals = {
  blockedEvent,
  changes,
  consent,
  event,
  locale,
  online,
  previewPanelAttached,
  previewPanelOpen,
  persistenceConsent,
  selectedOptimizations,
  canOptimize,
  profile,
  experienceRequestState,
}

/**
 * Pre-bundled reference to shared signal helpers.
 *
 * @public
 */
export const signalFns: SignalFns = {
  batch,
  computed,
  effect,
  untracked,
}

export { batch, effect, type Signal }

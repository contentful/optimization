import type {
  InsightsEvent as AnalyticsEvent,
  ChangeArray,
  ExperienceEvent as OptimizationEvent,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { batch, computed, effect, signal, type Signal, untracked } from '@preact/signals-core'
import type { BlockedEvent } from '../BlockedEvent'

/**
 * Latest optimization changes returned by the Experience API.
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
 * Most recent emitted optimization event.
 *
 * @public
 */
export const event: Signal<AnalyticsEvent | OptimizationEvent | undefined> = signal<
  AnalyticsEvent | OptimizationEvent | undefined
>()

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
 * Indicates whether the preview panel is currently open.
 *
 * @defaultValue `false`
 * @public
 */
export const previewPanelOpen = signal<boolean>(false)

/**
 * Latest selected optimization variants.
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
 * Collection of shared stateful Core signals.
 *
 * @public
 */
export interface Signals {
  /** Most recent blocked-event metadata. */
  blockedEvent: typeof blockedEvent
  /** Latest optimization changes payload. */
  changes: typeof changes
  /** Current consent signal. */
  consent: typeof consent
  /** Most recent emitted event signal. */
  event: typeof event
  /** Runtime connectivity signal. */
  online: typeof online
  /** Preview panel attachment signal. */
  previewPanelAttached: typeof previewPanelAttached
  /** Preview panel open-state signal. */
  previewPanelOpen: typeof previewPanelOpen
  /** Selected optimization variants signal. */
  selectedOptimizations: typeof selectedOptimizations
  /** Whether optimization selection data is currently available. */
  canOptimize: typeof canOptimize
  /** Active profile signal. */
  profile: typeof profile
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
  online,
  previewPanelAttached,
  previewPanelOpen,
  selectedOptimizations,
  canOptimize,
  profile,
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

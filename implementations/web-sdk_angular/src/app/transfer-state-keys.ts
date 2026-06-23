import { makeStateKey, type StateKey } from '@angular/core'
import type { Profile, SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { Entry } from 'contentful'

/**
 * Snapshot of the personalization context resolved server-side. Stamped into
 * `TransferState` during SSR and read by browser code on hydration.
 */
export interface ServerHandoff {
  /** Whether the request had `app-personalization-consent=granted`. */
  readonly consent: boolean
  /** Anonymous profile id observed in the request cookie (if any). */
  readonly profileId: string | undefined
  /** Profile snapshot returned by the server-side `page()` call. */
  readonly profile: Profile | undefined
  /** Selected optimizations the server applied when resolving baseline entries. */
  readonly selectedOptimizations: SelectedOptimizationArray | undefined
}

/**
 * Per-baseline-entry result of `sdk.resolveOptimizedEntry()` carried across
 * the hydration boundary. The browser uses these to skip a duplicate Experience
 * API roundtrip on initial render.
 */
export interface ResolvedEntryHandoff {
  readonly baseline: Entry
  readonly resolvedEntry: Entry
  readonly optimizationId: string | undefined
  readonly variantIndex: number | undefined
  readonly sticky: boolean | undefined
}

export const SERVER_OPTIMIZATION_KEY: StateKey<ServerHandoff> =
  makeStateKey<ServerHandoff>('ssr-optimization')

export const SERVER_RESOLVED_ENTRIES_KEY: StateKey<Record<string, ResolvedEntryHandoff>> =
  makeStateKey<Record<string, ResolvedEntryHandoff>>('ssr-resolved-entries')

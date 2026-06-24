import { makeStateKey, type StateKey } from '@angular/core'
import type {
  Profile,
  SelectedOptimization,
  SelectedOptimizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { Entry } from 'contentful'

/**
 * Snapshot of the personalization context resolved server-side. Stamped into
 * `TransferState` during SSR and read by browser code on hydration.
 */
export type ServerHandoff =
  | {
      readonly consent: false
    }
  | {
      readonly consent: true
      readonly profile: Profile
      readonly profileId: string
      readonly selectedOptimizations: SelectedOptimizationArray
    }

/**
 * Per-baseline-entry result of `sdk.resolveOptimizedEntry()` carried across
 * the hydration boundary. The browser uses these to skip a duplicate Experience
 * API roundtrip on initial render.
 */
export interface ResolvedEntryHandoff {
  readonly baseline: Entry
  readonly resolvedEntry: Entry
  readonly selectedOptimization: SelectedOptimization | null
}

export const SERVER_OPTIMIZATION_KEY: StateKey<ServerHandoff> =
  makeStateKey<ServerHandoff>('ssr-optimization')

export const SERVER_RESOLVED_ENTRIES_KEY: StateKey<Record<string, ResolvedEntryHandoff>> =
  makeStateKey<Record<string, ResolvedEntryHandoff>>('ssr-resolved-entries')

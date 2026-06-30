import { makeStateKey, type StateKey } from '@angular/core'
import type { Profile, SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'

export type ResolvedEntryData = ResolvedData<EntrySkeletonType>

/**
 * Snapshot of the personalization context resolved server-side. Stamped into
 * `TransferState` during SSR and read by browser code on hydration. The
 * personalization fields are present only when consent was granted server-side
 * and the preflight successfully fetched `OptimizationData`.
 */
export interface ServerHandoff {
  readonly consent: boolean
  readonly profile?: Profile
  readonly profileId?: string
  readonly selectedOptimizations?: SelectedOptimizationArray
}

export const SERVER_OPTIMIZATION_KEY: StateKey<ServerHandoff> =
  makeStateKey<ServerHandoff>('ssr-optimization')

/**
 * Server-resolved entries keyed by baseline entry id. The value is the raw
 * `sdk.resolveOptimizedEntry()` output (`{ entry, selectedOptimization? }`)
 * — no additional restructuring — so browser hydration can consume the SDK's
 * native shape directly.
 */
export const SERVER_RESOLVED_ENTRIES_KEY: StateKey<Record<string, ResolvedEntryData>> =
  makeStateKey<Record<string, ResolvedEntryData>>('ssr-resolved-entries')

/**
 * Baseline CDA entries keyed by id. Carried separately from the resolved
 * payload so the browser can skip a duplicate CDA fetch on hydration without
 * conflating the original entry with the resolved variant.
 */
export const SERVER_BASELINES_KEY: StateKey<Record<string, Entry>> =
  makeStateKey<Record<string, Entry>>('ssr-baselines')

/**
 * Framework-neutral runtime contracts for browser and snapshot-backed presentation layers.
 *
 * Re-exports the universal {@link OptimizationRuntime} / {@link createSnapshotRuntime} from
 * `@contentful/optimization-core/runtime` and adds the web-only composition
 * ({@link WebOptimizationRuntime} / {@link createWebSnapshotRuntime}) that stitches in
 * browser-only imperative APIs (`tracking`, `trackCurrentPage`) and managed entry fetch methods
 * so framework layers can bind a single runtime object across server rendering and browser
 * hydration.
 *
 * @packageDocumentation
 */

import {
  createSnapshotRuntime,
  type OptimizationRuntime,
  type OptimizationSnapshot,
} from '@contentful/optimization-core/runtime'
import type ContentfulOptimization from './ContentfulOptimization'

export * from '@contentful/optimization-core/runtime'

/**
 * Members of the live web SDK that go beyond the universal
 * {@link OptimizationRuntime} surface: browser-only imperative APIs used inside
 * effects (never during render).
 *
 * @internal
 */
type WebOnlyRuntimeMembers = 'tracking' | 'trackCurrentPage'
type ManagedEntryFetchMembers = 'fetchContentfulEntry' | 'fetchOptimizedEntry'

/**
 * The single runtime object framework layers (React Web, Angular, etc.) can consume.
 *
 * @remarks
 * Composes the universal {@link OptimizationRuntime} (pure resolvers, read `states`, event
 * actions — safe on server and client) with the browser-only web SDK surface
 * (`tracking`, `trackCurrentPage`). The live {@link ContentfulOptimization} instance
 * satisfies it by construction; a server / initial-render backing is produced by
 * {@link createWebSnapshotRuntime}, where the browser-only members are inert no-ops and managed
 * entry fetch methods reject until a live SDK is available.
 *
 * Every member is safe to reference in any environment: render-time members behave
 * correctly on the server, and effect-only members are no-ops there (the server never
 * runs effects, so this only matters defensively).
 *
 * @public
 */
export interface WebOptimizationRuntime
  extends
    OptimizationRuntime,
    Pick<ContentfulOptimization, ManagedEntryFetchMembers | WebOnlyRuntimeMembers> {}

const NOOP_TRACKING: WebOptimizationRuntime['tracking'] = {
  enable: noop,
  disable: noop,
  enableElement: noop,
  disableElement: noop,
  clearElement: noop,
}

function noop(): undefined {
  return undefined
}

async function rejectSnapshotManagedEntryFetch(): Promise<never> {
  return await Promise.reject(new Error('Live SDK needed'))
}

/**
 * Create a read-only {@link WebOptimizationRuntime} from a request-scoped snapshot.
 *
 * @param snapshot - Server-resolved optimization state for the current request.
 * @returns A runtime that resolves and reads from the snapshot, with browser-only tracking APIs as
 *   inert no-ops and managed entry fetch methods rejected.
 *
 * @remarks
 * Used by framework providers during server rendering and the initial client render,
 * before the live SDK exists. Delegates the universal surface to
 * {@link createSnapshotRuntime} and adds no-op `tracking` / `trackCurrentPage`.
 *
 * @public
 */
export function createWebSnapshotRuntime(snapshot?: OptimizationSnapshot): WebOptimizationRuntime {
  const runtime = createSnapshotRuntime(snapshot)

  return Object.assign(runtime, {
    fetchContentfulEntry: rejectSnapshotManagedEntryFetch,
    fetchOptimizedEntry: rejectSnapshotManagedEntryFetch,
    tracking: NOOP_TRACKING,
    trackCurrentPage: async () => await Promise.resolve({ accepted: false as const }),
  })
}

import type ContentfulOptimization from '@contentful/optimization-web'
import {
  createSnapshotRuntime,
  type OptimizationRuntime,
  type OptimizationSnapshot,
} from '@contentful/optimization-web/runtime'

/**
 * Members of the live web SDK that go beyond the universal
 * {@link OptimizationRuntime} surface: browser-only imperative APIs used inside
 * effects (never during render).
 *
 * @internal
 */
type WebOnlyRuntimeMembers = 'tracking' | 'trackCurrentPage'

/**
 * The single runtime object consumed by the React layer.
 *
 * @remarks
 * Composes the universal, isomorphic {@link OptimizationRuntime} (pure resolvers,
 * read `states`, and event actions) with the browser-only web SDK surface
 * (`tracking`, `trackCurrentPage`). The live {@link ContentfulOptimization}
 * instance satisfies it by construction; a server/initial-render backing is
 * produced by {@link createWebSnapshotRuntime}, where the browser-only members
 * are inert no-ops.
 *
 * Every member is safe to reference in any environment: render-time members
 * behave correctly on the server, and effect-only members are no-ops there (the
 * server never runs effects, so this only matters defensively).
 *
 * @public
 */
export interface WebOptimizationRuntime
  extends OptimizationRuntime, Pick<ContentfulOptimization, WebOnlyRuntimeMembers> {}

const NOOP_TRACKING: WebOptimizationRuntime['tracking'] = {
  enable: () => undefined,
  disable: () => undefined,
  enableElement: () => undefined,
  disableElement: () => undefined,
  clearElement: () => undefined,
}

/**
 * Create a read-only {@link WebOptimizationRuntime} from a request-scoped snapshot.
 *
 * @param snapshot - Server-resolved optimization state for the current request.
 * @returns A runtime that resolves and reads from the snapshot, with browser-only
 *   tracking APIs as inert no-ops.
 *
 * @remarks
 * Used by the provider during server rendering and the initial client render,
 * before the live SDK exists. Delegates the universal surface to
 * {@link createSnapshotRuntime} and adds no-op `tracking`/`trackCurrentPage`.
 *
 * @public
 */
export function createWebSnapshotRuntime(snapshot?: OptimizationSnapshot): WebOptimizationRuntime {
  const runtime = createSnapshotRuntime(snapshot)

  return Object.assign(runtime, {
    tracking: NOOP_TRACKING,
    trackCurrentPage: async () => await Promise.resolve({ accepted: false as const }),
  })
}

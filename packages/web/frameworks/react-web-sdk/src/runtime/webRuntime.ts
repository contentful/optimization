import type ContentfulOptimization from '@contentful/optimization-web'
import {
  createSnapshotRuntime,
  type OptimizationRuntime,
  type OptimizationSnapshot,
} from '@contentful/optimization-web/runtime'

type WebOnlyRuntimeMembers = 'tracking' | 'trackCurrentPage'

export interface WebOptimizationRuntime
  extends OptimizationRuntime, Pick<ContentfulOptimization, WebOnlyRuntimeMembers> {}

const NOOP_TRACKING: WebOptimizationRuntime['tracking'] = {
  enable: () => undefined,
  disable: () => undefined,
  enableElement: () => undefined,
  disableElement: () => undefined,
  clearElement: () => undefined,
}

export function createWebSnapshotRuntime(snapshot?: OptimizationSnapshot): WebOptimizationRuntime {
  const runtime = createSnapshotRuntime(snapshot)

  return Object.assign(runtime, {
    tracking: NOOP_TRACKING,
    trackCurrentPage: async () => await Promise.resolve({ accepted: false as const }),
  })
}

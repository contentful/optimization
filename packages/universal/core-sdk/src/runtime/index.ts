/**
 * Framework-neutral runtime contracts shared by stateful and snapshot-backed SDK surfaces.
 *
 * @packageDocumentation
 */

export type { OptimizationRuntime } from './OptimizationRuntime'
export {
  createSnapshotRuntime,
  type OptimizationSnapshot,
  type SnapshotRuntime,
} from './SnapshotRuntime'

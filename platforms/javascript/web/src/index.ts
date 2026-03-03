/**
 * Contentful Optimization Web SDK.
 *
 * @remarks
 * Re-exports the public surface of `@contentful/optimization-core` alongside
 * Web-specific utilities such as {@link Optimization}, {@link beaconHandler},
 * and {@link LocalStore}.
 *
 * @packageDocumentation
 */

import Optimization from './Optimization'

export * from '@contentful/optimization-core'

export * from './builders/EventBuilder'
export type {
  OptimizationTrackingApi,
  OptimizationWebConfig,
  OptimizationWebConfig as OptimizationConfig,
} from './Optimization'
export {
  CAN_ADD_LISTENERS,
  ENTRY_SELECTOR,
  HAS_MUTATION_OBSERVER,
  OPTIMIZATION_WEB_SDK_NAME,
  OPTIMIZATION_WEB_SDK_VERSION,
} from './constants'
export * from './handlers/beaconHandler'
export * from './storage/LocalStore'

export default Optimization

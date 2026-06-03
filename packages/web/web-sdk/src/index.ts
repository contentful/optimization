/**
 * Contentful ContentfulOptimization Web SDK.
 *
 * @remarks
 * Exposes Web-specific utilities such as {@link ContentfulOptimization}, {@link beaconHandler},
 * and `LocalStore`. Core and transitive API exports are available from
 * dedicated entrypoints:
 * `@contentful/optimization-web/core-sdk`,
 * `@contentful/optimization-web/api-client`,
 * and `@contentful/optimization-web/api-schemas`.
 *
 * @packageDocumentation
 */

import ContentfulOptimization from './ContentfulOptimization'

export * from './builders/EventBuilder'
export {
  CAN_ADD_LISTENERS,
  ENTRY_SELECTOR,
  HAS_MUTATION_OBSERVER,
  NODE_VIEW_SELECTOR,
  OPTIMIZATION_WEB_SDK_NAME,
  OPTIMIZATION_WEB_SDK_VERSION,
} from './constants'
export * from './ContentfulOptimization'
export type {
  AutoTrackEntryInteractionOptions,
  EntryClickInteractionElementOptions,
  EntryElementInteraction,
  EntryHoverInteractionElementOptions,
  EntryHoverInteractionStartOptions,
  EntryInteraction,
  EntryInteractionApi,
  EntryInteractionElementOptions,
  EntryInteractionElementOptionsMap,
  EntryInteractionStartOptions,
  EntryInteractionStartOptionsMap,
  EntryInteractionTracker,
  EntryInteractionTrackers,
  EntryViewInteractionElementOptions,
  EntryViewInteractionStartOptions,
} from './entry-tracking'
export * from './entry-tracking/resolveNodeViewPayload'
export * from './handlers/beaconHandler'
export * from './storage/LocalStore'

export default ContentfulOptimization

/**
 * Optimization Core SDK — platform-agnostic optimization and analytics.
 *
 * @packageDocumentation
 */

export {
  batch,
  effect,
  signalFns,
  signals,
  toDistinctObservable,
  toObservable,
  type ExperienceRequestFailureReason,
  type ExperienceRequestState,
  type Observable,
  type Signal,
  type SignalFns,
  type Signals,
  type Subscription,
} from './signals'

export * from './consent'
export * from './constants'
export type * from './CoreApiConfig'
export * from './CoreBase'
export * from './CoreStateful'
export * from './CoreStateless'
export * from './CoreStatelessRequest'
export * from './events'
export * from './lib/decorators'
export * from './lib/interceptor'
export type {
  QueueFlushFailureContext,
  QueueFlushPolicy,
  QueueFlushRecoveredContext,
} from './lib/queue'
export * from './locale'
export type * from './OptimizedEntryMetadata'
export * from './page-context'
export type { ExperienceQueue } from './queues/ExperienceQueue'
export type { InsightsQueue } from './queues/InsightsQueue'
export * from './resolvers'
export * from './StatefulDefaults'
export * from './tracking'

export { default as CoreStateful } from './CoreStateful'
export { default as CoreStateless } from './CoreStateless'

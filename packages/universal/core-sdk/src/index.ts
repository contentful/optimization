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
  type Signal,
  type SignalFns,
  type Signals,
} from './signals'

export type * from './BlockedEvent'
export * from './constants'
export * from './CoreBase'
export * from './CoreStateful'
export * from './CoreStateless'
export * from './events'
export * from './lib/decorators'
export * from './lib/interceptor'
export * from './resolvers'
export * from './symbols'

export { default as CoreStateful } from './CoreStateful'
export { default as CoreStateless } from './CoreStateless'

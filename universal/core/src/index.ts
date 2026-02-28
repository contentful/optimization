/**
 * Optimization Core SDK — platform-agnostic personalization and analytics.
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

export * from '@contentful/optimization-api-client'
export * from 'logger'
export * from './analytics'
export type * from './BlockedEvent'
export * from './constants'
export * from './CoreBase'
export * from './CoreStateful'
export * from './CoreStateless'
export * from './lib/decorators'
export * from './lib/interceptor'
export * from './personalization'
export * from './symbols'

export { default as CoreStateful } from './CoreStateful'
export { default as CoreStateless } from './CoreStateless'

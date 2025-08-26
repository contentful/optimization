// TODO: Explore the idea of package path exports for all but CoreBase & subclasses
// TODO: No barrel exports anywhere
export type * from './lib/logger'
export type * from './lib/api-client'
export type * from './analytics'
export type * from './flags'
export type * from './personalization'

export * from './lib/logger'
export * from './lib/api-client'
export * from './analytics'
export * from './flags'
export * from './personalization'

export type { Signals } from './CoreBase'

export { signals } from './CoreBase'

export { default as CoreStateful } from './CoreStateful'
export { default as CoreStateless } from './CoreStateless'

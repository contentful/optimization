import CoreBase from './CoreBase'

// TODO: Explore the idea of package path exports for all but CoreBase & subclasses
export type * from './lib/logger'
export type * from './lib/api-client'
export type * from './analytics'
export type * from './audience'
export type * from './experiments'
export type * from './flags'
export type * from './personalization'

export * from './lib/logger'
export * from './lib/api-client'
export * from './analytics'
export * from './audience'
export * from './experiments'
export * from './flags'
export * from './personalization'

export { default as Analytics } from './analytics'
export { default as Audience } from './audience'
export { default as AudienceMapper } from './audience/Mapper'
export { default as Experiments } from './experiments'
export { default as ExperimentsMapper } from './experiments/Mapper'
export { default as Personalizations } from './personalization'
export { default as PersonalizationsMapper } from './personalization/Mapper'

export default CoreBase

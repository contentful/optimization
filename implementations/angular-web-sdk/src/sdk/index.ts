export { NG_CONTENTFUL_OPTIMIZATION_CONFIG, type NgContentfulOptimizationConfig } from './config'
export { NgContentfulClient } from './services/contentful-client'
export { NgContentfulLiveEntry } from './services/live-entry'
export { NgContentfulLiveUpdates } from './services/live-updates'
export { MergeTagPipe, isMergeTagEntry } from './services/merge-tag.pipe'
export {
  NgContentfulOptimization,
  fromSdkObservable,
  type NgContentfulOptimizationInstance,
} from './services/optimization'
export {
  NgContentfulOptimizationResolver,
  type EntryMeta,
  type ResolvedData,
  type ResolvedEntryView,
} from './services/optimization-resolver'
export { isRecord } from './utils'

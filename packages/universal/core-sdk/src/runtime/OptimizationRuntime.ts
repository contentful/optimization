import type CoreStateful from '../CoreStateful'

type RuntimeMembers =
  | 'consent'
  | 'destroy'
  | 'flush'
  | 'getFlag'
  | 'getMergeTagValue'
  | 'hasConsent'
  | 'identify'
  | 'locale'
  | 'page'
  | 'reset'
  | 'resolveOptimizedEntry'
  | 'screen'
  | 'setLocale'
  | 'states'
  | 'track'
  | 'trackClick'
  | 'trackFlagView'
  | 'trackHover'
  | 'trackView'

/**
 * Runtime contract shared by the stateful core and snapshot runtimes.
 *
 * @remarks
 * This surface includes consumer-facing runtime methods and state, excluding SDK infrastructure
 * such as API clients, interceptors, and internal resolvers.
 *
 * @public
 */
export interface OptimizationRuntime extends Pick<CoreStateful, RuntimeMembers> {}

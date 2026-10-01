import type {
  OptimizationCacheMetadata,
  PrivateRequestOptimizationCacheMetadata,
  StatefulDefaults,
} from '@contentful/optimization-react-web/core-sdk'
import type { CoreStatelessRequestConsent } from './server'

const REQUEST_HANDOFF_CACHE_SCOPE_ERROR =
  'Request handoffs must use private-request cache scope. Use public permutation handoffs for public cache scopes, or a non-request handoff for static output.'

export function assertRequestHandoffCacheMetadata(
  cache: OptimizationCacheMetadata,
): asserts cache is PrivateRequestOptimizationCacheMetadata {
  if (cache.scope === 'private-request') return
  throw new TypeError(REQUEST_HANDOFF_CACHE_SCOPE_ERROR)
}

export function toHandoffDefaults(consent: CoreStatelessRequestConsent): StatefulDefaults {
  if (typeof consent === 'boolean') {
    return { consent, persistenceConsent: consent }
  }

  return {
    ...(consent.events === undefined ? {} : { consent: consent.events }),
    persistenceConsent: consent.persistence ?? false,
  }
}

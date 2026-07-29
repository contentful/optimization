import type {
  OptimizationCacheMetadata,
  PrivateRequestOptimizationCacheMetadata,
  StatefulDefaults,
} from '@contentful/optimization-react-web/core-sdk'
import {
  NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER,
  parseNextjsOptimizationRequestContext,
} from './request-context'
import type { CoreStatelessRequestConsent } from './server'

const REQUEST_HANDOFF_CACHE_SCOPE_ERROR =
  'Request handoffs must use private-request cache scope. Use public permutation handoffs for public cache scopes, or a non-request handoff for static output.'

export interface NextjsForwardedServerData {
  readonly consent: CoreStatelessRequestConsent
  readonly pageAccepted: boolean
  readonly profileId?: string
}

interface ForwardedProfileOptionsInput {
  readonly experienceOptions?: {
    readonly ip?: string
    readonly locale?: string
  }
  readonly locale?: string
}

export function assertRequestHandoffCacheMetadata(
  cache: OptimizationCacheMetadata,
): asserts cache is PrivateRequestOptimizationCacheMetadata {
  if (cache.scope === 'private-request') return
  throw new TypeError(REQUEST_HANDOFF_CACHE_SCOPE_ERROR)
}

export function readNextjsForwardedServerData(
  headers: Headers,
  trustedRequestHandoff: true | undefined,
): NextjsForwardedServerData | undefined {
  if (trustedRequestHandoff === undefined) return undefined

  const encodedValue = headers.get(NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER)

  if (encodedValue === null) return undefined

  const value = parseNextjsOptimizationRequestContext(encodedValue)

  return isNextjsForwardedServerData(value) ? value : undefined
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

export function toForwardedProfileOptions(
  options: ForwardedProfileOptionsInput,
  configLocale: string | undefined,
): { readonly ip?: string; readonly locale?: string } {
  const locale = options.locale ?? configLocale ?? options.experienceOptions?.locale

  return {
    ...(options.experienceOptions?.ip === undefined ? {} : { ip: options.experienceOptions.ip }),
    ...(locale === undefined ? {} : { locale }),
  }
}

function isNextjsForwardedServerData(value: unknown): value is NextjsForwardedServerData {
  return (
    isRecord(value) &&
    isCoreStatelessRequestConsent(value.consent) &&
    typeof value.pageAccepted === 'boolean' &&
    (value.profileId === undefined || isProfileId(value.profileId))
  )
}

function isCoreStatelessRequestConsent(value: unknown): value is CoreStatelessRequestConsent {
  if (typeof value === 'boolean') return true
  if (!isRecord(value)) return false

  return (
    (value.events === undefined || typeof value.events === 'boolean') &&
    (value.persistence === undefined || typeof value.persistence === 'boolean')
  )
}

function isProfileId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

import type {
  OptimizationAnalyticsRootProps,
  OptimizationProviderConfigProps,
  OptimizationRootProps,
  OptimizedEntryProps,
} from '@contentful/optimization-react-web'
import type { ReactNode } from 'react'

export type NextjsBoundProviderConfig = Omit<
  OptimizationProviderConfigProps,
  'children' | 'cookie' | 'handoff' | 'hydration' | 'prefetchManagedEntries' | 'sdk'
>

export interface NextjsCookieValue {
  readonly value: string
}

export interface NextjsCookieReader {
  get: (name: string) => NextjsCookieValue | undefined
}

export type NextjsOptimizationServerConsent =
  | boolean
  | {
      readonly events?: boolean
      readonly persistence?: boolean
    }

export interface NextjsOptimizationServerConsentContext {
  readonly cookies: NextjsCookieReader
  readonly headers: Headers
}

export type NextjsOptimizationServerConsentResolver = (
  context: NextjsOptimizationServerConsentContext,
) => NextjsOptimizationServerConsent | Promise<NextjsOptimizationServerConsent>

export interface NextjsOptimizationCookieConfig {
  readonly domain?: string
  readonly expires?: number
}

export interface NextjsOptimizationConsentConfig {
  readonly server?: NextjsOptimizationServerConsent | NextjsOptimizationServerConsentResolver
  readonly clientDefaults?: NextjsPagesRouterClientDefaults
}

export type NextjsBoundRootConfig = Omit<NextjsBoundProviderConfig, 'defaults'> & {
  readonly consent?: NextjsOptimizationConsentConfig
  readonly cookie?: NextjsOptimizationCookieConfig
} & Pick<OptimizationRootProps, 'liveUpdates'>

export type NextjsOptimizationComponentsConfig = NextjsBoundRootConfig

export type NextjsPagesRouterOptimizationComponentsConfig = NextjsBoundRootConfig

export interface NextjsPagesRouterClientDefaults {
  readonly consent?: boolean
  readonly persistenceConsent?: boolean
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

export type NextjsBoundOptimizedEntryProps = DistributiveOmit<
  OptimizedEntryProps,
  'liveUpdates' | 'loadingFallback'
>

export type NextjsServerOptimizedEntryProps = NextjsBoundOptimizedEntryProps

export interface BoundNextjsOptimizationProviderProps extends Pick<
  OptimizationProviderConfigProps,
  'handoff' | 'hydration' | 'prefetchManagedEntries'
> {
  readonly children?: ReactNode
}

export interface BoundNextjsOptimizationRootProps
  extends
    BoundNextjsOptimizationProviderProps,
    Pick<OptimizationRootProps, 'buildPagePayload' | 'initialPagePayload' | 'routeKey'> {}

export type BoundNextjsOptimizationAnalyticsRootProps = Omit<
  OptimizationAnalyticsRootProps,
  | 'api'
  | 'clientId'
  | 'contentful'
  | 'cookie'
  | 'environment'
  | 'fetchOptions'
  | 'locale'
  | 'logLevel'
  | 'sdk'
  | 'trackEntryInteraction'
>

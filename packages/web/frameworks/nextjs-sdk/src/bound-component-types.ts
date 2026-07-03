import type { OptimizationRootProps, OptimizedEntryProps } from '@contentful/optimization-react-web'
import type { ReactNode } from 'react'

export type NextjsBoundProviderConfig = Omit<OptimizationRootProps, 'children' | 'liveUpdates'>

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

export type NextjsOptimizationServerOptions =
  | {
      readonly enabled: true
      readonly consent: NextjsOptimizationServerConsent | NextjsOptimizationServerConsentResolver
    }
  | {
      readonly enabled?: false
      readonly consent?: never
    }

export interface NextjsOptimizationCookieConfig {
  readonly domain?: string
  readonly expires?: number
}

export type NextjsBoundRootConfig = Omit<
  OptimizationRootProps,
  'children' | 'cookie' | 'sdk' | 'serverOptimizationState'
> & {
  readonly cookie?: NextjsOptimizationCookieConfig
}

export type NextjsOptimizationComponentsConfig = NextjsBoundRootConfig & {
  readonly server?: NextjsOptimizationServerOptions
}

export type NextjsPagesRouterOptimizationComponentsConfig = NextjsBoundRootConfig

export interface NextjsPagesRouterClientDefaults {
  readonly consent?: boolean
  readonly persistenceConsent?: boolean
}

export type NextjsBoundOptimizedEntryProps = Omit<
  OptimizedEntryProps,
  'liveUpdates' | 'loadingFallback'
>

export type NextjsServerOptimizedEntryProps = NextjsBoundOptimizedEntryProps

export interface BoundNextjsOptimizationRootProps {
  readonly children?: ReactNode
}

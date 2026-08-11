import type {
  OptimizationAnalyticsRootProps,
  OptimizationProviderConfigProps,
  OptimizationRootProps,
  OptimizedEntryBaselineProps,
  OptimizedEntryManagedProps,
  OptimizedEntryProps,
} from '@contentful/optimization-react-web'
import type { NextAppAutoPageTrackerProps } from '@contentful/optimization-react-web/next-app'
import type { ChainModifiers, EntrySkeletonType, LocaleCode } from 'contentful'
import type { ReactElement, ReactNode } from 'react'
import type { ContentOptimizationHydrationMode } from './handoff'

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

export interface NextjsAppRouterRequestContext {
  readonly requestUrl: string
  readonly routeKey: string
}

export type NextjsAppRouterRequestHydration =
  | ContentOptimizationHydrationMode
  | ((context: NextjsAppRouterRequestContext) => ContentOptimizationHydrationMode)

export interface NextjsAppRouterRequestConfig {
  readonly hydration?: NextjsAppRouterRequestHydration
  readonly trustedRequestHandoff?: true
}

export interface NextjsAppRouterServerOptimizationConfig extends NextjsOptimizationComponentsConfig {
  readonly request?: NextjsAppRouterRequestConfig
}

export type NextjsPagesRouterOptimizationComponentsConfig = NextjsBoundRootConfig

export interface NextjsPagesRouterClientDefaults {
  readonly consent?: boolean
  readonly persistenceConsent?: boolean
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

export type NextjsBoundOptimizedEntryBaselineProps<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = Omit<OptimizedEntryBaselineProps<S, M, L>, 'liveUpdates' | 'loadingFallback'>

export type NextjsBoundOptimizedEntryManagedProps<
  S extends EntrySkeletonType = EntrySkeletonType,
  L extends LocaleCode = LocaleCode,
> = DistributiveOmit<OptimizedEntryManagedProps<S, L>, 'liveUpdates' | 'loadingFallback'>

export type NextjsBoundOptimizedEntryProps<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = DistributiveOmit<OptimizedEntryProps<S, M, L>, 'liveUpdates' | 'loadingFallback'>

export type NextjsServerOptimizedEntryProps<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = NextjsBoundOptimizedEntryProps<S, M, L>

export interface NextjsBoundOptimizedEntryComponent<TResult> {
  <
    S extends EntrySkeletonType = EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    props: NextjsBoundOptimizedEntryBaselineProps<S, M, L>,
  ): TResult
  <S extends EntrySkeletonType = EntrySkeletonType, L extends LocaleCode = LocaleCode>(
    props: NextjsBoundOptimizedEntryManagedProps<S, L>,
  ): TResult
  (props: NextjsBoundOptimizedEntryProps): TResult
}

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

export type NextjsAppRouterRequestOptimizationRootProps = Omit<
  BoundNextjsOptimizationRootProps,
  'buildPagePayload' | 'handoff' | 'hydration' | 'initialPagePayload' | 'routeKey'
>

export type NextjsAppRouterRequestOptimizationProviderProps = Omit<
  BoundNextjsOptimizationProviderProps,
  'handoff' | 'hydration'
>

export type NextjsAppRouterRequestAutoPageTrackerProps = Omit<
  NextAppAutoPageTrackerProps,
  'initialPageEvent'
>

export interface NextjsAppRouterRequestOptimization {
  readonly OptimizationRoot: (
    props: NextjsAppRouterRequestOptimizationRootProps,
  ) => Promise<ReactElement>
  readonly OptimizationProvider: (
    props: NextjsAppRouterRequestOptimizationProviderProps,
  ) => Promise<ReactElement | null>
  readonly OptimizedEntry: NextjsBoundOptimizedEntryComponent<Promise<ReactElement>>
  readonly NextAppAutoPageTracker: (
    props: NextjsAppRouterRequestAutoPageTrackerProps,
  ) => Promise<ReactElement>
}

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

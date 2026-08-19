'use client'

import {
  LiveUpdatesProvider as ReactWebLiveUpdatesProvider,
  OptimizationAnalyticsRoot as ReactWebOptimizationAnalyticsRoot,
  OptimizationProvider as ReactWebOptimizationProvider,
  OptimizationRoot as ReactWebOptimizationRoot,
  OptimizedEntry as ReactWebOptimizedEntry,
  type OptimizationRootProps,
  type OptimizationAnalyticsRootProps as ReactWebOptimizationAnalyticsRootProps,
} from '@contentful/optimization-react-web'
import { resolveEntriesForSelections } from '@contentful/optimization-react-web/core-sdk'
import {
  NextAppAutoPageTracker,
  useNextAppAutoPageInputs,
  type NextAppAutoPageContext,
  type NextAppAutoPageTrackerProps,
} from '@contentful/optimization-react-web/router/next-app'
import { createElement, type ReactElement } from 'react'
import type {
  BoundNextjsAppRouterRequestClientRootProps,
  BoundNextjsOptimizationAnalyticsRootProps,
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  BoundNextjsOptimizationRootWithBeforeInitialPageProps,
  NextjsBoundOptimizedEntryComponent,
  NextjsBoundProviderConfig,
  NextjsClientOptimizationConfig,
  NextjsClientOptimizationConfigWithBeforeInitialPage,
  NextjsClientOptimizationConfigWithoutBeforeInitialPage,
} from './bound-component-types'
import {
  createHandoffFromSelections,
  createOptimizationCacheKey,
  createPublicPermutationCacheMetadata,
  createPublicPermutationHandoff,
} from './handoff'

export type {
  BeforeInitialPageClient,
  BeforeInitialPageOptions,
} from '@contentful/optimization-react-web'
export type {
  BoundNextjsAppRouterRequestClientRootProps,
  BoundNextjsOptimizationAnalyticsRootProps,
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  BoundNextjsOptimizationRootWithBeforeInitialPageProps,
  NextjsBoundOptimizedEntryProps,
  NextjsClientOptimizationConfig,
  NextjsClientOptimizationConfigWithBeforeInitialPage,
  NextjsClientOptimizationConfigWithoutBeforeInitialPage,
  NextjsCookieReader,
  NextjsCookieValue,
  NextjsOptimizationComponentsConfig,
  NextjsOptimizationConsentConfig,
  NextjsOptimizationCookieConfig,
  NextjsOptimizationServerConsent,
  NextjsOptimizationServerConsentContext,
  NextjsOptimizationServerConsentResolver,
} from './bound-component-types'
export {
  createHandoffFromSelections,
  createOptimizationCacheKey,
  createPublicPermutationCacheMetadata,
  createPublicPermutationHandoff,
  NextAppAutoPageTracker,
  resolveEntriesForSelections,
  type NextAppAutoPageContext,
  type NextAppAutoPageTrackerProps,
}

export interface NextjsAppRouterClientOptimization {
  readonly OptimizationRoot: (props: BoundNextjsOptimizationRootProps) => ReactElement
  readonly OptimizationProvider: (
    props: BoundNextjsOptimizationProviderProps,
  ) => ReactElement | null
  readonly OptimizationAnalyticsRoot: (
    props: BoundNextjsOptimizationAnalyticsRootProps,
  ) => ReactElement
  readonly OptimizedEntry: NextjsBoundOptimizedEntryComponent<ReactElement | null>
  readonly NextAppAutoPageTracker: typeof NextAppAutoPageTracker
  readonly createHandoffFromSelections: typeof createHandoffFromSelections
  readonly createOptimizationCacheKey: typeof createOptimizationCacheKey
  readonly createPublicPermutationHandoff: typeof createPublicPermutationHandoff
  readonly resolveEntriesForSelections: typeof resolveEntriesForSelections
}

export interface NextjsAppRouterClientOptimizationWithBeforeInitialPage extends Omit<
  NextjsAppRouterClientOptimization,
  'OptimizationRoot'
> {
  readonly OptimizationRoot: (
    props: BoundNextjsOptimizationRootWithBeforeInitialPageProps,
  ) => ReactElement
  readonly RequestOptimizationRoot: (
    props: BoundNextjsAppRouterRequestClientRootProps,
  ) => ReactElement
}

export function bindNextjsAppRouterClientOptimization(
  config: NextjsClientOptimizationConfigWithoutBeforeInitialPage,
): NextjsAppRouterClientOptimization
export function bindNextjsAppRouterClientOptimization(
  config: NextjsClientOptimizationConfigWithBeforeInitialPage,
): NextjsAppRouterClientOptimizationWithBeforeInitialPage
export function bindNextjsAppRouterClientOptimization(
  config: NextjsClientOptimizationConfig,
): NextjsAppRouterClientOptimization | NextjsAppRouterClientOptimizationWithBeforeInitialPage
export function bindNextjsAppRouterClientOptimization(
  config: NextjsClientOptimizationConfig,
): NextjsAppRouterClientOptimization | NextjsAppRouterClientOptimizationWithBeforeInitialPage {
  const { beforeInitialPage } = config
  const rootConfig = toClientRootConfig(config)
  const providerConfig = toClientProviderConfig(config)
  const analyticsRootConfig = toAnalyticsRootConfig(config)

  function OptimizationRootWithoutBeforeInitialPage({
    children,
    ...rootProps
  }: BoundNextjsOptimizationRootProps): ReactElement {
    return createElement(ReactWebOptimizationRoot, { ...rootConfig, ...rootProps }, children)
  }

  function OptimizationRootWithBeforeInitialPage({
    children,
    ...rootProps
  }: BoundNextjsOptimizationRootWithBeforeInitialPageProps): ReactElement {
    return createElement(
      ReactWebOptimizationRoot,
      { ...rootConfig, ...rootProps, beforeInitialPage },
      children,
    )
  }

  function RequestOptimizationRoot({
    children,
    ...requestRootProps
  }: BoundNextjsAppRouterRequestClientRootProps): ReactElement {
    const { buildPagePayload, routeKey } = useNextAppAutoPageInputs()

    return createElement(
      ReactWebOptimizationRoot,
      {
        ...rootConfig,
        ...requestRootProps,
        buildPagePayload,
        beforeInitialPage,
        routeKey,
      },
      children,
    )
  }

  function OptimizationProvider({
    children,
    handoff,
    hydration,
    prefetchManagedEntries,
  }: BoundNextjsOptimizationProviderProps): ReactElement | null {
    return createElement(
      ReactWebOptimizationProvider,
      { ...providerConfig, handoff, hydration, prefetchManagedEntries },
      createElement(
        ReactWebLiveUpdatesProvider,
        { globalLiveUpdates: config.liveUpdates },
        children,
      ),
    )
  }

  function OptimizationAnalyticsRoot(
    props: BoundNextjsOptimizationAnalyticsRootProps,
  ): ReactElement {
    return createElement(ReactWebOptimizationAnalyticsRoot, { ...analyticsRootConfig, ...props })
  }

  const commonResult = {
    NextAppAutoPageTracker,
    OptimizationAnalyticsRoot,
    OptimizationProvider,
    OptimizedEntry: ReactWebOptimizedEntry,
    createHandoffFromSelections,
    createOptimizationCacheKey,
    createPublicPermutationHandoff,
    resolveEntriesForSelections,
  }

  if (beforeInitialPage === undefined) {
    return { ...commonResult, OptimizationRoot: OptimizationRootWithoutBeforeInitialPage }
  }

  return {
    ...commonResult,
    OptimizationRoot: OptimizationRootWithBeforeInitialPage,
    RequestOptimizationRoot,
  }
}

function toClientRootConfig(
  config: NextjsClientOptimizationConfig,
): NextjsBoundProviderConfig & Pick<OptimizationRootProps, 'liveUpdates'> {
  const {
    consent,
    cookie: _cookie,
    beforeInitialPage: _beforeInitialPage,
    ...clientConfig
  } = config

  return {
    ...clientConfig,
    defaults: consent?.clientDefaults,
  }
}

function toClientProviderConfig(config: NextjsClientOptimizationConfig): NextjsBoundProviderConfig {
  const { liveUpdates: _liveUpdates, ...providerConfig } = toClientRootConfig(config)

  return providerConfig
}

function toAnalyticsRootConfig(
  config: NextjsClientOptimizationConfig,
): Omit<ReactWebOptimizationAnalyticsRootProps, keyof BoundNextjsOptimizationAnalyticsRootProps> {
  const { liveUpdates: _liveUpdates, ...rootConfig } = toClientRootConfig(config)

  return rootConfig
}

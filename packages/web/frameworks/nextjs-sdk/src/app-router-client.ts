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
  type NextAppAutoPageContext,
  type NextAppAutoPageTrackerProps,
} from '@contentful/optimization-react-web/router/next-app'
import { createElement, type ReactElement } from 'react'
import type {
  BoundNextjsOptimizationAnalyticsRootProps,
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  NextjsBoundOptimizedEntryProps,
  NextjsBoundProviderConfig,
  NextjsOptimizationComponentsConfig,
} from './bound-component-types'
import { createHandoffFromSelections, createOptimizationCacheKey } from './handoff'

export type {
  BoundNextjsOptimizationAnalyticsRootProps,
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  NextjsBoundOptimizedEntryProps,
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
  NextAppAutoPageTracker,
  resolveEntriesForSelections,
  type NextAppAutoPageContext,
  type NextAppAutoPageTrackerProps,
}

export interface NextjsOptimizationComponents {
  readonly OptimizationRoot: (props: BoundNextjsOptimizationRootProps) => ReactElement
  readonly OptimizationProvider: (
    props: BoundNextjsOptimizationProviderProps,
  ) => ReactElement | null
  readonly OptimizationAnalyticsRoot: (
    props: BoundNextjsOptimizationAnalyticsRootProps,
  ) => ReactElement
  readonly OptimizedEntry: (props: NextjsBoundOptimizedEntryProps) => ReactElement | null
  readonly NextAppAutoPageTracker: typeof NextAppAutoPageTracker
  readonly createHandoffFromSelections: typeof createHandoffFromSelections
  readonly createOptimizationCacheKey: typeof createOptimizationCacheKey
  readonly resolveEntriesForSelections: typeof resolveEntriesForSelections
}

export function bindNextjsAppRouterOptimization(
  config: NextjsOptimizationComponentsConfig,
): NextjsOptimizationComponents {
  const rootConfig = toClientRootConfig(config)
  const providerConfig = toClientProviderConfig(config)
  const analyticsRootConfig = toAnalyticsRootConfig(config)

  function OptimizationRoot({
    children,
    ...rootProps
  }: BoundNextjsOptimizationRootProps): ReactElement {
    return createElement(ReactWebOptimizationRoot, { ...rootConfig, ...rootProps }, children)
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

  return {
    NextAppAutoPageTracker,
    OptimizationAnalyticsRoot,
    OptimizationProvider,
    OptimizationRoot,
    OptimizedEntry: ReactWebOptimizedEntry,
    createHandoffFromSelections,
    createOptimizationCacheKey,
    resolveEntriesForSelections,
  }
}

function toClientRootConfig(
  config: NextjsOptimizationComponentsConfig,
): NextjsBoundProviderConfig & Pick<OptimizationRootProps, 'liveUpdates'> {
  const { consent, cookie: _cookie, ...clientConfig } = config

  return {
    ...clientConfig,
    defaults: consent?.clientDefaults,
  }
}

function toClientProviderConfig(
  config: NextjsOptimizationComponentsConfig,
): NextjsBoundProviderConfig {
  const { liveUpdates: _liveUpdates, ...providerConfig } = toClientRootConfig(config)

  return providerConfig
}

function toAnalyticsRootConfig(
  config: NextjsOptimizationComponentsConfig,
): Omit<ReactWebOptimizationAnalyticsRootProps, keyof BoundNextjsOptimizationAnalyticsRootProps> {
  const { liveUpdates: _liveUpdates, ...rootConfig } = toClientRootConfig(config)

  return rootConfig
}

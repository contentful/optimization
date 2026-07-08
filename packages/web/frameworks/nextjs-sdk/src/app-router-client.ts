'use client'

import {
  LiveUpdatesProvider as ReactWebLiveUpdatesProvider,
  OptimizationProvider as ReactWebOptimizationProvider,
  OptimizationRoot as ReactWebOptimizationRoot,
  OptimizedEntry as ReactWebOptimizedEntry,
  type OptimizationRootProps,
} from '@contentful/optimization-react-web'
import {
  NextAppAutoPageTracker,
  type NextAppAutoPageContext,
  type NextAppAutoPageTrackerProps,
} from '@contentful/optimization-react-web/router/next-app'
import { createElement, type ReactElement } from 'react'
import type {
  BoundNextjsOptimizationRootProps,
  NextjsBoundOptimizedEntryProps,
  NextjsBoundProviderConfig,
  NextjsOptimizationComponentsConfig,
} from './bound-component-types'

export type {
  BoundNextjsOptimizationRootProps,
  NextjsBoundOptimizedEntryProps,
  NextjsCookieReader,
  NextjsCookieValue,
  NextjsOptimizationComponentsConfig,
  NextjsOptimizationCookieConfig,
  NextjsOptimizationServerConsent,
  NextjsOptimizationServerConsentContext,
  NextjsOptimizationServerConsentResolver,
  NextjsOptimizationServerOptions,
} from './bound-component-types'
export { NextAppAutoPageTracker, type NextAppAutoPageContext, type NextAppAutoPageTrackerProps }

export interface NextjsOptimizationComponents {
  readonly OptimizationRoot: (props: BoundNextjsOptimizationRootProps) => ReactElement
  readonly OptimizationProvider: (props: BoundNextjsOptimizationRootProps) => ReactElement | null
  readonly OptimizedEntry: (props: NextjsBoundOptimizedEntryProps) => ReactElement | null
  readonly NextAppAutoPageTracker: typeof NextAppAutoPageTracker
  readonly proxy: undefined
}

export function createNextjsAppRouterOptimization(
  config: NextjsOptimizationComponentsConfig,
): NextjsOptimizationComponents {
  const rootConfig = toClientRootConfig(config)
  const providerConfig = toClientProviderConfig(config)

  function OptimizationRoot({
    children,
    prefetchedManagedEntries,
    prefetchManagedEntries,
  }: BoundNextjsOptimizationRootProps): ReactElement {
    return createElement(
      ReactWebOptimizationRoot,
      { ...rootConfig, prefetchedManagedEntries, prefetchManagedEntries },
      children,
    )
  }

  function OptimizationProvider({
    children,
    prefetchedManagedEntries,
    prefetchManagedEntries,
  }: BoundNextjsOptimizationRootProps): ReactElement | null {
    return createElement(
      ReactWebOptimizationProvider,
      { ...providerConfig, prefetchedManagedEntries, prefetchManagedEntries },
      createElement(
        ReactWebLiveUpdatesProvider,
        { globalLiveUpdates: config.liveUpdates },
        children,
      ),
    )
  }

  return {
    NextAppAutoPageTracker,
    OptimizationProvider,
    OptimizationRoot,
    OptimizedEntry: ReactWebOptimizedEntry,
    proxy: undefined,
  }
}

function toClientRootConfig(
  config: NextjsOptimizationComponentsConfig,
): Omit<
  OptimizationRootProps,
  | 'children'
  | 'prefetchedManagedEntries'
  | 'prefetchManagedEntries'
  | 'sdk'
  | 'serverOptimizationState'
> {
  const { server: _server, ...clientConfig } = config
  return clientConfig
}

function toClientProviderConfig(
  config: NextjsOptimizationComponentsConfig,
): NextjsBoundProviderConfig {
  const { liveUpdates: _liveUpdates, server: _server, ...providerConfig } = config
  const clientProviderConfig: NextjsBoundProviderConfig = providerConfig
  return clientProviderConfig
}

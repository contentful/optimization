'use client'

import {
  LiveUpdatesProvider as ReactWebLiveUpdatesProvider,
  OptimizationProvider as ReactWebOptimizationProvider,
  OptimizationRoot as ReactWebOptimizationRoot,
  OptimizedEntry as ReactWebOptimizedEntry,
  type OptimizationRootProps,
  type OptimizedEntryProps,
} from '@contentful/optimization-react-web'
import {
  NextPagesAutoPageTracker,
  type NextPagesAutoPageContext,
  type NextPagesAutoPageTrackerProps,
} from '@contentful/optimization-react-web/router/next-pages'
import { createElement, type ReactElement } from 'react'
import type {
  BoundNextjsOptimizationRootProps,
  NextjsBoundProviderConfig,
  NextjsPagesRouterClientDefaults,
  NextjsPagesRouterOptimizationComponentsConfig,
} from './bound-component-types'

export type {
  BoundNextjsOptimizationRootProps,
  NextjsOptimizationCookieConfig,
  NextjsPagesRouterClientDefaults,
  NextjsPagesRouterOptimizationComponentsConfig,
} from './bound-component-types'
export {
  NextPagesAutoPageTracker,
  type NextPagesAutoPageContext,
  type NextPagesAutoPageTrackerProps,
}

export interface BoundNextjsPagesRouterOptimizationRootProps
  extends BoundNextjsOptimizationRootProps, Pick<OptimizationRootProps, 'serverOptimizationState'> {
  readonly clientDefaults?: NextjsPagesRouterClientDefaults
}

export interface NextjsPagesRouterOptimization {
  readonly OptimizationRoot: (props: BoundNextjsPagesRouterOptimizationRootProps) => ReactElement
  readonly OptimizationProvider: (
    props: BoundNextjsPagesRouterOptimizationRootProps,
  ) => ReactElement | null
  readonly OptimizedEntry: (props: OptimizedEntryProps) => ReactElement | null
  readonly NextPagesAutoPageTracker: typeof NextPagesAutoPageTracker
}

export function createNextjsPagesRouterOptimization(
  config: NextjsPagesRouterOptimizationComponentsConfig,
): NextjsPagesRouterOptimization {
  const rootConfig = toClientRootConfig(config)
  const providerConfig = toClientProviderConfig(config)

  function OptimizationRoot({
    children,
    clientDefaults,
    prefetchedManagedEntries,
    prefetchManagedEntries,
    serverOptimizationState,
  }: BoundNextjsPagesRouterOptimizationRootProps): ReactElement {
    return createElement(
      ReactWebOptimizationRoot,
      {
        ...rootConfig,
        defaults: resolveClientDefaults(rootConfig.defaults, clientDefaults),
        prefetchedManagedEntries,
        prefetchManagedEntries,
        serverOptimizationState,
      },
      children,
    )
  }

  function OptimizationProvider({
    children,
    clientDefaults,
    prefetchedManagedEntries,
    prefetchManagedEntries,
    serverOptimizationState,
  }: BoundNextjsPagesRouterOptimizationRootProps): ReactElement | null {
    return createElement(
      ReactWebOptimizationProvider,
      {
        ...providerConfig,
        defaults: resolveClientDefaults(providerConfig.defaults, clientDefaults),
        prefetchedManagedEntries,
        prefetchManagedEntries,
        serverOptimizationState,
      },
      createElement(
        ReactWebLiveUpdatesProvider,
        { globalLiveUpdates: config.liveUpdates },
        children,
      ),
    )
  }

  return {
    NextPagesAutoPageTracker,
    OptimizationProvider,
    OptimizationRoot,
    OptimizedEntry: ReactWebOptimizedEntry,
  }
}

function toClientRootConfig(
  config: NextjsPagesRouterOptimizationComponentsConfig,
): Omit<
  OptimizationRootProps,
  | 'children'
  | 'prefetchedManagedEntries'
  | 'prefetchManagedEntries'
  | 'sdk'
  | 'serverOptimizationState'
> {
  const clientConfig = config
  return clientConfig
}

function toClientProviderConfig(
  config: NextjsPagesRouterOptimizationComponentsConfig,
): Omit<
  NextjsBoundProviderConfig,
  'prefetchedManagedEntries' | 'prefetchManagedEntries' | 'serverOptimizationState'
> {
  const { liveUpdates: _liveUpdates, ...providerConfig } = config
  return providerConfig
}

function resolveClientDefaults(
  defaults: OptimizationRootProps['defaults'],
  clientDefaults: NextjsPagesRouterClientDefaults | undefined,
): OptimizationRootProps['defaults'] {
  if (clientDefaults === undefined) return defaults

  return {
    ...defaults,
    ...clientDefaults,
  }
}

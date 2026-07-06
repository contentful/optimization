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

export * from '@contentful/optimization-react-web'
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

  function OptimizationRoot({ children }: BoundNextjsOptimizationRootProps): ReactElement {
    return createElement(ReactWebOptimizationRoot, rootConfig, children)
  }

  function OptimizationProvider({
    children,
  }: BoundNextjsOptimizationRootProps): ReactElement | null {
    return createElement(
      ReactWebOptimizationProvider,
      providerConfig,
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
): Omit<OptimizationRootProps, 'children' | 'sdk' | 'serverOptimizationState'> {
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

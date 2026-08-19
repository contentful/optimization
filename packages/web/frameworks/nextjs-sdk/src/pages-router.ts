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
import {
  resolveEntriesForSelections,
  type StatefulDefaults,
} from '@contentful/optimization-react-web/core-sdk'
import {
  NextPagesAutoPageTracker,
  type NextPagesAutoPageContext,
  type NextPagesAutoPageTrackerProps,
} from '@contentful/optimization-react-web/router/next-pages'
import { createElement, type ReactElement } from 'react'
import type {
  BoundNextjsOptimizationAnalyticsRootProps,
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  BoundNextjsOptimizationRootWithBeforeInitialPageProps,
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
  type BrowserOptimizationHandoff,
} from './handoff'

type PagesRouterRequestDefaultsHandoff = BrowserOptimizationHandoff & {
  readonly defaults?: StatefulDefaults
}

export type {
  BeforeInitialPageClient,
  BeforeInitialPageOptions,
} from '@contentful/optimization-react-web'
export type {
  BoundNextjsOptimizationAnalyticsRootProps,
  BoundNextjsOptimizationProviderProps,
  BoundNextjsOptimizationRootProps,
  BoundNextjsOptimizationRootWithBeforeInitialPageProps,
  NextjsClientOptimizationConfig,
  NextjsClientOptimizationConfigWithBeforeInitialPage,
  NextjsClientOptimizationConfigWithoutBeforeInitialPage,
  NextjsOptimizationComponentsConfig,
  NextjsOptimizationConsentConfig,
  NextjsOptimizationCookieConfig,
} from './bound-component-types'
export {
  createHandoffFromSelections,
  createOptimizationCacheKey,
  createPublicPermutationCacheMetadata,
  createPublicPermutationHandoff,
  NextPagesAutoPageTracker,
  resolveEntriesForSelections,
  type NextPagesAutoPageContext,
  type NextPagesAutoPageTrackerProps,
}

export interface NextjsPagesRouterOptimization {
  readonly OptimizationRoot: (props: BoundNextjsOptimizationRootProps) => ReactElement
  readonly OptimizationProvider: (
    props: BoundNextjsOptimizationProviderProps,
  ) => ReactElement | null
  readonly OptimizationAnalyticsRoot: (
    props: BoundNextjsOptimizationAnalyticsRootProps,
  ) => ReactElement
  readonly OptimizedEntry: typeof ReactWebOptimizedEntry
  readonly NextPagesAutoPageTracker: typeof NextPagesAutoPageTracker
  readonly createHandoffFromSelections: typeof createHandoffFromSelections
  readonly createOptimizationCacheKey: typeof createOptimizationCacheKey
  readonly createPublicPermutationHandoff: typeof createPublicPermutationHandoff
  readonly resolveEntriesForSelections: typeof resolveEntriesForSelections
}

export interface NextjsPagesRouterOptimizationWithBeforeInitialPage extends Omit<
  NextjsPagesRouterOptimization,
  'OptimizationRoot'
> {
  readonly OptimizationRoot: (
    props: BoundNextjsOptimizationRootWithBeforeInitialPageProps,
  ) => ReactElement
}

export function bindNextjsPagesRouterOptimization(
  config: NextjsClientOptimizationConfigWithoutBeforeInitialPage,
): NextjsPagesRouterOptimization
export function bindNextjsPagesRouterOptimization(
  config: NextjsClientOptimizationConfigWithBeforeInitialPage,
): NextjsPagesRouterOptimizationWithBeforeInitialPage
export function bindNextjsPagesRouterOptimization(
  config: NextjsClientOptimizationConfig,
): NextjsPagesRouterOptimization | NextjsPagesRouterOptimizationWithBeforeInitialPage
export function bindNextjsPagesRouterOptimization(
  config: NextjsClientOptimizationConfig,
): NextjsPagesRouterOptimization | NextjsPagesRouterOptimizationWithBeforeInitialPage {
  const { beforeInitialPage } = config
  const rootConfig = toClientRootConfig(config)
  const providerConfig = toClientProviderConfig(config)
  const analyticsRootConfig = toAnalyticsRootConfig(config)

  function OptimizationRootWithoutBeforeInitialPage({
    children,
    ...rootProps
  }: BoundNextjsOptimizationRootProps): ReactElement {
    return createElement(
      ReactWebOptimizationRoot,
      withRequestDefaults({ ...rootConfig, ...rootProps }, rootProps.handoff),
      children,
    )
  }

  function OptimizationRootWithBeforeInitialPage({
    children,
    ...rootProps
  }: BoundNextjsOptimizationRootWithBeforeInitialPageProps): ReactElement {
    return createElement(
      ReactWebOptimizationRoot,
      withRequestDefaults({ ...rootConfig, ...rootProps, beforeInitialPage }, rootProps.handoff),
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
      withRequestDefaults(
        { ...providerConfig, handoff, hydration, prefetchManagedEntries },
        handoff,
      ),
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
    return createElement(
      ReactWebOptimizationAnalyticsRoot,
      withRequestDefaults({ ...analyticsRootConfig, ...props }, props.handoff),
    )
  }

  const commonResult = {
    NextPagesAutoPageTracker,
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

  return { ...commonResult, OptimizationRoot: OptimizationRootWithBeforeInitialPage }
}

function withRequestDefaults<T extends { readonly defaults?: StatefulDefaults }>(
  props: T,
  handoff: BrowserOptimizationHandoff | undefined,
): T & { readonly defaults?: StatefulDefaults } {
  const defaults = (handoff as PagesRouterRequestDefaultsHandoff | undefined)?.defaults

  if (defaults === undefined) return props

  return {
    ...props,
    defaults: {
      ...props.defaults,
      ...defaults,
    },
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

import {
  LiveUpdatesProvider as ReactWebLiveUpdatesProvider,
  OptimizationProvider as ReactWebOptimizationProvider,
  type OptimizedEntryRenderContext,
  type OptimizationRootProps as ReactWebOptimizationRootProps,
  type OptimizedEntryProps as ReactWebOptimizedEntryProps,
} from '@contentful/optimization-react-web'
import {
  NextAppAutoPageTracker,
  type NextAppAutoPageContext,
  type NextAppAutoPageTrackerProps,
} from '@contentful/optimization-react-web/router/next-app'
import { headers as readNextjsHeaders } from 'next/headers'
import { cache, createElement, type ReactElement, type ReactNode } from 'react'
import type {
  BoundNextjsOptimizationRootProps,
  NextjsBoundOptimizedEntryProps,
  NextjsBoundProviderConfig,
  NextjsOptimizationComponentsConfig,
} from './bound-component-types'
import {
  NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER,
  parseNextjsOptimizationRequestContext,
} from './request-context'
import type {
  NextjsOptimizationContextHandlerOptions,
  NextjsOptimizationRequestHandler,
} from './request-handler'
import { createNextjsOptimizationContextHandler } from './request-handler'
import {
  createNextjsOptimization,
  type CoreStatelessRequestConsent,
  type NextjsAnonymousIdCookieOptions,
  type OptimizationData,
  type OptimizationNodeConfig,
} from './server'
import { renderOptimizedEntryOnServer } from './server-entry-renderer'
import type { ServerTrackingResolvedData } from './tracking-attributes'

export type { OptimizedEntryRenderContext } from '@contentful/optimization-react-web'
export type {
  BoundNextjsOptimizationRootProps,
  NextjsBoundOptimizedEntryProps,
  NextjsOptimizationComponentsConfig,
  NextjsOptimizationCookieConfig,
  NextjsOptimizationServerConsentContext,
  NextjsOptimizationServerConsentResolver,
  NextjsOptimizationServerOptions,
  NextjsServerOptimizedEntryProps,
} from './bound-component-types'
export { NextAppAutoPageTracker, type NextAppAutoPageContext, type NextAppAutoPageTrackerProps }
type IgnoredReactWebOptimizedEntryProps = Pick<
  ReactWebOptimizedEntryProps,
  'liveUpdates' | 'loadingFallback'
>

export interface NextjsOptimizationComponents {
  readonly OptimizationRoot: (props: BoundNextjsOptimizationRootProps) => Promise<ReactElement>
  readonly OptimizationProvider: (
    props: BoundNextjsOptimizationRootProps,
  ) => Promise<ReactElement | null>
  readonly OptimizedEntry: (props: NextjsBoundOptimizedEntryProps) => Promise<ReactElement>
  readonly NextAppAutoPageTracker: typeof NextAppAutoPageTracker
  readonly proxy: NextjsOptimizationRequestHandler
}

interface NextjsAutomaticServerOptimizationData {
  readonly consent: CoreStatelessRequestConsent | undefined
  readonly data: OptimizationData | undefined
}

interface LooseServerOptions {
  readonly enabled?: boolean
  readonly consent?: unknown
}

const SECONDS_IN_DAY = 86_400

export function createNextjsAppRouterOptimization(
  config: NextjsOptimizationComponentsConfig,
): NextjsOptimizationComponents {
  validateServerOptions(config.server)

  const sdk = createNextjsOptimization(toServerOptimizationConfig(config))
  const proxy = createNextjsOptimizationContextHandler(
    config.server?.enabled === true ? toContextHandlerOptions(config, sdk) : undefined,
  )
  const loadServerData = cache(async (): Promise<NextjsAutomaticServerOptimizationData> => {
    if (config.server?.enabled !== true) return { consent: undefined, data: undefined }

    const headerStore = await readNextjsHeaders()
    const serverData = parseNextjsOptimizationRequestContext(
      headerStore.get(NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER),
    )
    if (!isAutomaticServerOptimizationData(serverData)) {
      throw new Error(
        'createNextjsAppRouterOptimization() requires exporting its proxy from proxy.ts with a matching Next.js config when server.enabled is true.',
      )
    }

    return serverData
  })

  async function OptimizationRoot({
    children,
  }: BoundNextjsOptimizationRootProps): Promise<ReactElement> {
    const serverData = await loadServerData()
    return createElement(
      ReactWebOptimizationProvider,
      toClientProviderConfig(config, serverData),
      createElement(
        ReactWebLiveUpdatesProvider,
        { globalLiveUpdates: config.liveUpdates },
        children,
      ),
    )
  }

  async function OptimizationProvider({
    children,
  }: BoundNextjsOptimizationRootProps): Promise<ReactElement | null> {
    const serverData = await loadServerData()
    return createElement(
      ReactWebOptimizationProvider,
      toClientProviderConfig(config, serverData),
      createElement(
        ReactWebLiveUpdatesProvider,
        { globalLiveUpdates: config.liveUpdates },
        children,
      ),
    )
  }

  async function OptimizedEntry(props: NextjsBoundOptimizedEntryProps): Promise<ReactElement> {
    const {
      baselineEntry,
      children,
      liveUpdates: _liveUpdates,
      loadingFallback: _loadingFallback,
      testId,
      'data-testid': dataTestId,
      ...serverEntryProps
    } = props as NextjsBoundOptimizedEntryProps & Partial<IgnoredReactWebOptimizedEntryProps>
    const { data } = await loadServerData()
    const resolvedData = sdk.resolveOptimizedEntry(baselineEntry, data?.selectedOptimizations)
    const renderContext: OptimizedEntryRenderContext = {
      getMergeTagValue: (embeddedEntryNodeTarget, profile) =>
        sdk.getMergeTagValue(embeddedEntryNodeTarget, profile ?? data?.profile),
    }
    const testAttributes =
      dataTestId === undefined && testId === undefined
        ? {}
        : {
            'data-testid': dataTestId ?? testId,
          }

    return renderOptimizedEntryOnServer({
      ...serverEntryProps,
      ...testAttributes,
      baselineEntry,
      children: resolveOptimizedEntryChildren(children, resolvedData.entry, renderContext),
      resolvedData,
    })
  }

  return {
    NextAppAutoPageTracker,
    OptimizationProvider,
    OptimizationRoot,
    OptimizedEntry,
    proxy,
  }
}

function validateServerOptions(options: LooseServerOptions | undefined): void {
  if (options?.enabled === true && options.consent === undefined) {
    throw new Error(
      'createNextjsAppRouterOptimization() requires server.consent when server.enabled is true.',
    )
  }
}

function toContextHandlerOptions(
  config: NextjsOptimizationComponentsConfig,
  sdk: ReturnType<typeof createNextjsOptimization>,
): NextjsOptimizationContextHandlerOptions {
  return {
    consent: config.server?.enabled === true ? config.server.consent : false,
    cookieOptions: toAnonymousIdCookieOptions(config.cookie),
    locale: config.locale,
    sdk,
  }
}

function toAnonymousIdCookieOptions(
  cookie: NextjsOptimizationComponentsConfig['cookie'],
): NextjsAnonymousIdCookieOptions | undefined {
  if (cookie === undefined) return undefined

  const cookieOptions: NextjsAnonymousIdCookieOptions = {
    ...(cookie.domain ? { domain: cookie.domain } : {}),
    ...(typeof cookie.expires === 'number' && Number.isFinite(cookie.expires)
      ? { maxAge: Math.trunc(cookie.expires * SECONDS_IN_DAY) }
      : {}),
  }

  return Object.keys(cookieOptions).length === 0 ? undefined : cookieOptions
}

function toServerOptimizationConfig(
  config: NextjsOptimizationComponentsConfig,
): OptimizationNodeConfig {
  const {
    cookie: _cookie,
    defaults: _defaults,
    liveUpdates: _liveUpdates,
    onStatesReady: _onStatesReady,
    server: _server,
    trackEntryInteraction: _trackEntryInteraction,
    ...serverConfig
  } = config

  return serverConfig as OptimizationNodeConfig
}

function toClientProviderConfig(
  config: NextjsOptimizationComponentsConfig,
  serverData: NextjsAutomaticServerOptimizationData,
): NextjsBoundProviderConfig {
  const { liveUpdates: _liveUpdates, server: _server, ...providerConfig } = config
  const clientProviderConfig: NextjsBoundProviderConfig = {
    ...providerConfig,
    defaults: resolveClientDefaults(providerConfig.defaults, serverData.consent),
    serverOptimizationState: serverData.data,
  }
  return clientProviderConfig
}

function resolveClientDefaults(
  defaults: ReactWebOptimizationRootProps['defaults'],
  consent: CoreStatelessRequestConsent | undefined,
): ReactWebOptimizationRootProps['defaults'] {
  if (consent === undefined) return defaults

  if (typeof consent === 'boolean') {
    return {
      ...defaults,
      consent,
      persistenceConsent: consent,
    }
  }

  return {
    ...defaults,
    consent: consent.events ?? defaults?.consent,
    persistenceConsent: consent.persistence ?? defaults?.persistenceConsent,
  }
}

function resolveOptimizedEntryChildren(
  children: ReactWebOptimizedEntryProps['children'],
  entry: ServerTrackingResolvedData['entry'],
  context: OptimizedEntryRenderContext,
): ReactNode {
  return typeof children === 'function' ? children(entry, context) : children
}

function isAutomaticServerOptimizationData(
  value: unknown,
): value is NextjsAutomaticServerOptimizationData {
  if (!isRecord(value)) return false

  return (
    isServerConsent(value.consent) && (value.data === undefined || isOptimizationData(value.data))
  )
}

function isServerConsent(value: unknown): value is CoreStatelessRequestConsent {
  if (typeof value === 'boolean') return true
  if (!isRecord(value)) return false

  return (
    (value.events === undefined || typeof value.events === 'boolean') &&
    (value.persistence === undefined || typeof value.persistence === 'boolean')
  )
}

function isOptimizationData(value: unknown): value is OptimizationData {
  if (!isRecord(value)) return false

  return (
    Array.isArray(value.changes) &&
    Array.isArray(value.selectedOptimizations) &&
    isRecord(value.profile) &&
    typeof value.profile.id === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

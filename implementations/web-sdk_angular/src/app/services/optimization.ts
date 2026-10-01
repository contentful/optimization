import { isPlatformBrowser } from '@angular/common'
import {
  DestroyRef,
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  provideAppInitializer,
  REQUEST,
  signal,
  TransferState,
  type EnvironmentProviders,
  type Signal,
  type StateKey,
  type WritableSignal,
} from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import type NodeContentfulOptimizationType from '@contentful/optimization-node'
import { createRequestHandoffFromPreview } from '@contentful/optimization-node'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import type {
  CoreStatelessRequest,
  UniversalEventBuilderArgs,
} from '@contentful/optimization-node/core-sdk'
import ContentfulOptimization from '@contentful/optimization-web'
import type { Profile, SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { assertOptimizationCacheSafety } from '@contentful/optimization-web/core-sdk'
import type { ContentOptimizationHandoff } from '@contentful/optimization-web/handoff'
import { createScopedLogger } from '@contentful/optimization-web/logger'
import {
  createWebSnapshotRuntime,
  type OptimizationSnapshot,
  type WebOptimizationRuntime,
} from '@contentful/optimization-web/runtime'
import type { Entry } from 'contentful'
import { PAGES } from 'e2e-web'
import { filter } from 'rxjs/operators'
import type { NgContentfulOptimizationConfig } from '../config'
import {
  getOrCreateBaseClient,
  NG_CONTENTFUL_OPTIMIZATION_CONFIG,
  resolveLogLevel,
} from '../config'
import { fromSdkState } from '../utils'
import { readConsentFromRequest } from './consent'
import { NgContentfulClient, SERVER_BASELINES_KEY } from './contentful-client'

/**
 * SSR handoff for the personalization runtime. Stamped by the server preflight,
 * read on the browser to seed the initial snapshot runtime before the live SDK
 * takes over. The handoff owns resolved optimization data; defaults preserve
 * the request's consent, persistence, and locale for snapshot rendering.
 */
interface ServerOptimizationTransfer {
  readonly defaults: Pick<OptimizationSnapshot, 'consent' | 'persistenceConsent' | 'locale'>
  readonly handoff: ContentOptimizationHandoff | undefined
}

const SERVER_OPTIMIZATION_KEY: StateKey<ServerOptimizationTransfer> =
  makeStateKey<ServerOptimizationTransfer>('ssr-optimization')

function createOptimizationSnapshot(
  transfer: ServerOptimizationTransfer | undefined,
): OptimizationSnapshot | undefined {
  if (transfer === undefined) return undefined

  return {
    ...transfer.defaults,
    ...(transfer.handoff?.state === undefined ? {} : { data: transfer.handoff.state }),
  }
}

/**
 * Shared SDK-config mapping used by both the browser Web SDK constructor and
 * the server Node SDK constructor. The two SDK classes accept the same shape
 * for these fields, so the mapping lives here once.
 */
function toSdkConstructorArgs(config: NgContentfulOptimizationConfig): {
  spaceId: string
  environment: string
  logLevel: 'debug' | 'warn' | 'error'
  locale: string
  app: NgContentfulOptimizationConfig['app']
  api: { insightsBaseUrl: string; experienceBaseUrl: string }
} {
  return {
    spaceId: config.spaceId,
    environment: config.environment,
    logLevel: resolveLogLevel(config.logLevel),
    locale: config.locale,
    app: config.app,
    api: {
      insightsBaseUrl: config.insightsBaseUrl,
      experienceBaseUrl: config.experienceBaseUrl,
    },
  }
}

let instance: ContentfulOptimization | undefined = undefined
const previewPanelLogger = createScopedLogger('AngularReference:PreviewPanel')
const hydrationLogger = createScopedLogger('AngularReference:SsrHydration')

async function attachPreviewPanel(
  sdk: ContentfulOptimization,
  config: NgContentfulOptimizationConfig,
): Promise<void> {
  const contentfulClient = getOrCreateBaseClient(config)
  const { default: attach } = await import('@contentful/optimization-web-preview-panel')
  await attach({
    contentful: contentfulClient,
    optimization: sdk,
    nonce: config.previewPanel?.nonce,
  })
}

// Kept as module-scope helpers (rather than instance methods) so SonarQube
// typescript:S7059 does not fire on in-constructor async work.

async function hydrateSnapshotAndPromote(
  sdk: ContentfulOptimization,
  handoff: ContentOptimizationHandoff | undefined,
  runtimeSignal: WritableSignal<WebOptimizationRuntime>,
  routeKey: string,
): Promise<void> {
  if (handoff !== undefined) assertOptimizationCacheSafety(handoff)
  try {
    await sdk.hydrateAndTrackCurrentPage(handoff, {
      buildPayload: () => ({ properties: { url: window.location.origin + routeKey } }),
      routeKey,
      onHydrated: (error) => {
        runtimeSignal.set(sdk)
        if (error !== undefined)
          hydrationLogger.warn('Failed to hydrate live SDK from SSR snapshot.', error)
      },
    })
  } catch (error) {
    hydrationLogger.warn('Failed to track the initial browser page.', error)
  }
}

function attachPreviewPanelSafely(
  sdk: ContentfulOptimization,
  config: NgContentfulOptimizationConfig,
): void {
  attachPreviewPanel(sdk, config).catch((error: unknown) => {
    previewPanelLogger.warn('Failed to attach the Contentful Optimization preview panel.', error)
  })
}

function getOrCreateInstance(
  config: NgContentfulOptimizationConfig,
  snapshot: OptimizationSnapshot | undefined,
): ContentfulOptimization {
  instance ??= new ContentfulOptimization({
    ...toSdkConstructorArgs(config),
    defaults: {
      consent: snapshot?.consent,
      persistenceConsent: snapshot?.persistenceConsent,
    },
    autoTrackEntryInteraction: config.autoTrackEntryInteraction ?? {
      views: true,
      clicks: true,
      hovers: true,
    },
  })
  return instance
}

/**
 * Single SDK service exposed to components. Both server and browser see the
 * same {@link WebOptimizationRuntime}: on the server (and during the initial
 * client render) it is a read-only {@link createWebSnapshotRuntime} backed by
 * the SSR handoff, with `tracking.*` and `trackCurrentPage` as inert no-ops;
 * on the browser after construction it swaps to the live
 * {@link ContentfulOptimization}. Every member — resolvers, `states`, event
 * actions, and even the browser-only tracking imperatives — is safe to call
 * unconditionally in components.
 */
@Injectable({ providedIn: 'root' })
export class NgContentfulOptimization {
  readonly runtime: Signal<WebOptimizationRuntime>
  readonly consent: Signal<boolean | undefined>
  readonly profile: Signal<Profile | undefined>
  readonly selectedOptimizations: Signal<SelectedOptimizationArray | undefined>

  constructor() {
    const config = inject(NG_CONTENTFUL_OPTIMIZATION_CONFIG)
    const router = inject(Router)
    const destroyRef = inject(DestroyRef)
    const transferState = inject(TransferState)
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID))
    const transfer = transferState.get<ServerOptimizationTransfer | undefined>(
      SERVER_OPTIMIZATION_KEY,
      undefined,
    )
    const snapshot = createOptimizationSnapshot(transfer)
    const handoff = transfer?.handoff

    const runtimeSignal = signal<WebOptimizationRuntime>(createWebSnapshotRuntime(snapshot))
    this.runtime = runtimeSignal.asReadonly()
    this.consent = fromSdkState(() => runtimeSignal().states.consent)
    this.profile = fromSdkState(() => runtimeSignal().states.profile)
    this.selectedOptimizations = fromSdkState(() => runtimeSignal().states.selectedOptimizations)

    if (!isBrowser) {
      // Server render: the snapshot runtime satisfies the full seam. Reads
      // flow through `states.*`, resolvers/getMergeTagValue are pure, event
      // actions are inert dev-warn no-ops, and `tracking.*` is a NOOP object.
      return
    }

    const sdk = getOrCreateInstance(config, snapshot)

    // Prime the live SDK with the server-computed snapshot before promoting
    // it to the runtime signal, so the first live render matches the SSR
    // HTML (same selectedOptimizations, same profile, same merge tags).
    // With no server data (consent denied or preflight skipped), the snapshot
    // runtime and the fresh live SDK already share the same initial state, so
    // we can swap immediately.
    const promotion = hydrateSnapshotAndPromote(
      sdk,
      handoff,
      runtimeSignal,
      window.location.pathname + window.location.search,
    )

    if (config.previewPanel !== undefined) {
      attachPreviewPanelSafely(sdk, config)
    }

    const routerSubscription = router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const { urlAfterRedirects: routeKey } = e
        void promotion
          .then(async () => {
            await sdk.trackCurrentPage({
              buildPayload: () => ({
                properties: { url: window.location.origin + routeKey },
              }),
              routeKey,
            })
          })
          .catch((error: unknown) => {
            hydrationLogger.warn('Failed to track a navigation after SSR hydration.', error)
          })
      })

    destroyRef.onDestroy(() => {
      routerSubscription.unsubscribe()
      sdk.destroy()
      instance = undefined
    })
  }
}

// ── Server-side preflight ──────────────────────────────────────────────────
//
// The helpers below run only on the server (in the @angular/ssr render
// pipeline) and dynamic-import @contentful/optimization-node so the Node SDK
// never reaches the browser bundle. They are exposed via
// `provideServerOptimizationInitializer()` so `app.config.server.ts` only
// needs a single import to wire them in.

async function createServerOptimization(
  config: NgContentfulOptimizationConfig,
): Promise<NodeContentfulOptimizationType> {
  const { default: NodeContentfulOptimization } = await import('@contentful/optimization-node')
  return new NodeContentfulOptimization(toSdkConstructorArgs(config))
}

function readAnonymousId(request: Request): string | undefined {
  const cookieHeader = request.headers.get('cookie') ?? ''
  for (const cookie of cookieHeader.split(';')) {
    const [name, value] = cookie.trim().split('=', 2)
    if (name === ANONYMOUS_ID_COOKIE && value) return value
  }
  return undefined
}

/**
 * Build an event context for the SSR `forRequest()` call so the server-side
 * page event carries the current route. Without this, route-targeted
 * experiences resolve against an empty page context and miss on first paint.
 * Mirrors `createNextjsRequestContext` from the Next.js adapter.
 */
function createServerEventContext(request: Request, locale: string): UniversalEventBuilderArgs {
  const url = new URL(request.url)
  return {
    locale,
    userAgent: request.headers.get('user-agent') ?? undefined,
    page: {
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      referrer: request.headers.get('referer') ?? '',
      search: url.search,
      url: request.url,
    },
  }
}

interface ServerPreflightOutcome {
  readonly defaults: ServerOptimizationTransfer['defaults']
  readonly handoff: ContentOptimizationHandoff | undefined
}

async function computeSnapshot(
  sdk: NodeContentfulOptimizationType,
  request: Request,
  consentGranted: boolean,
  locale: string,
): Promise<ServerPreflightOutcome> {
  if (!consentGranted) {
    return {
      defaults: { consent: false, locale },
      handoff: undefined,
    }
  }

  const anonymousId = readAnonymousId(request)
  const requestOptimization: CoreStatelessRequest = sdk.forRequest({
    consent: { events: true, persistence: true },
    locale,
    eventContext: createServerEventContext(request, locale),
    ...(anonymousId === undefined ? {} : { profile: { id: anonymousId } }),
  })
  const url = new URL(request.url)
  const routeKey = `${url.pathname}${url.search}`
  const preview = await requestOptimization.previewInitialExperience({
    page: {
      properties: {
        path: url.pathname,
        search: url.search,
        url: request.url,
      },
    },
  })
  if (!preview.accepted) {
    return {
      defaults: { consent: false, locale },
      handoff: undefined,
    }
  }

  return {
    defaults: {
      consent: true,
      persistenceConsent: requestOptimization.canPersistProfile,
      locale,
    },
    handoff: createRequestHandoffFromPreview({ preview, routeKey, hydration: 'preserve-server' }),
  }
}

async function runServerPreflight(): Promise<void> {
  const request = inject(REQUEST, { optional: true })
  if (!request) return

  const transferState = inject(TransferState)
  const config = inject(NG_CONTENTFUL_OPTIMIZATION_CONFIG)
  const contentful = inject(NgContentfulClient)

  const consentGranted = readConsentFromRequest(request)
  let outcome: ServerPreflightOutcome = {
    defaults: { consent: consentGranted, locale: config.locale },
    handoff: undefined,
  }
  let baselines: Entry[] = []
  try {
    const sdk = await createServerOptimization(config)
    const baselineIds = [...new Set([...PAGES.home.ids, ...PAGES.pageTwo.ids])]
    baselines = await contentful.fetchEntries(baselineIds)
    outcome = await computeSnapshot(sdk, request, consentGranted, config.locale)
  } catch (error) {
    hydrationLogger.warn('Failed to prepare the server optimization preview.', error)
  }

  transferState.set<ServerOptimizationTransfer>(SERVER_OPTIMIZATION_KEY, outcome)
  transferState.set<Record<string, Entry>>(
    SERVER_BASELINES_KEY,
    Object.fromEntries(baselines.map((baseline) => [baseline.sys.id, baseline])),
  )
}

/**
 * Wires the server-side SDK preflight into Angular's application
 * initializers. Imported from `app.config.server.ts`.
 */
export function provideServerOptimizationInitializer(): EnvironmentProviders {
  return provideAppInitializer(runServerPreflight)
}

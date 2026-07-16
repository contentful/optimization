import { isPlatformBrowser } from '@angular/common'
import {
  DestroyRef,
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  provideAppInitializer,
  REQUEST,
  RESPONSE_INIT,
  signal,
  TransferState,
  type EnvironmentProviders,
  type Signal,
  type StateKey,
  type WritableSignal,
} from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import type NodeContentfulOptimizationType from '@contentful/optimization-node'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import type {
  CoreStatelessRequest,
  UniversalEventBuilderArgs,
} from '@contentful/optimization-node/core-sdk'
import ContentfulOptimization from '@contentful/optimization-web'
import type { Profile, SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { hydrateOptimizationHandoff } from '@contentful/optimization-web/handoff'
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
 * takes over. The shape matches {@link OptimizationSnapshot} so the same
 * request-scoped payload backs `createSnapshotRuntime` on both sides of the
 * hydration boundary.
 */
const SERVER_OPTIMIZATION_KEY: StateKey<OptimizationSnapshot> =
  makeStateKey<OptimizationSnapshot>('ssr-optimization')

/**
 * Shared SDK-config mapping used by both the browser Web SDK constructor and
 * the server Node SDK constructor. The two SDK classes accept the same shape
 * for these fields, so the mapping lives here once.
 */
function toSdkConstructorArgs(config: NgContentfulOptimizationConfig): {
  clientId: string
  environment: string
  logLevel: 'debug' | 'warn' | 'error'
  locale: string
  app: NgContentfulOptimizationConfig['app']
  api: { insightsBaseUrl: string; experienceBaseUrl: string }
} {
  return {
    clientId: config.clientId,
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

function hydrateSnapshotAndPromote(
  sdk: ContentfulOptimization,
  snapshot: OptimizationSnapshot | undefined,
  runtimeSignal: WritableSignal<WebOptimizationRuntime>,
): void {
  if (!snapshot?.data) {
    runtimeSignal.set(sdk)
    return
  }
  hydrateOptimizationHandoff(sdk, {
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    initialPageEvent: snapshot.consent === true ? 'skip' : 'emit',
    state: snapshot.data,
  })
    .then(() => {
      runtimeSignal.set(sdk)
    })
    .catch((error: unknown) => {
      hydrationLogger.warn('Failed to hydrate live SDK from SSR snapshot.', error)
      runtimeSignal.set(sdk)
    })
}

function attachPreviewPanelSafely(
  sdk: ContentfulOptimization,
  config: NgContentfulOptimizationConfig,
): void {
  attachPreviewPanel(sdk, config).catch((error: unknown) => {
    previewPanelLogger.warn('Failed to attach the Contentful Optimization preview panel.', error)
  })
}

function getOrCreateInstance(config: NgContentfulOptimizationConfig): ContentfulOptimization {
  instance ??= new ContentfulOptimization({
    ...toSdkConstructorArgs(config),
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
    const snapshot = transferState.get<OptimizationSnapshot | undefined>(
      SERVER_OPTIMIZATION_KEY,
      undefined,
    )

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

    const sdk = getOrCreateInstance(config)

    // Prime the live SDK with the server-computed snapshot before promoting
    // it to the runtime signal, so the first live render matches the SSR
    // HTML (same selectedOptimizations, same profile, same merge tags).
    // With no server data (consent denied or preflight skipped), the snapshot
    // runtime and the fresh live SDK already share the same initial state, so
    // we can swap immediately.
    hydrateSnapshotAndPromote(sdk, snapshot, runtimeSignal)

    if (config.previewPanel !== undefined) {
      attachPreviewPanelSafely(sdk, config)
    }

    // Page events fire on every route change. The first NavigationEnd after
    // hydration is skipped when the server preflight already emitted page()
    // for the same route (consent was granted server-side) — without this
    // skip, analytics double-counts the SSR landing page. Subsequent
    // navigations always emit.
    let skipNextPage = snapshot?.consent ?? false
    const routerSubscription = router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        if (skipNextPage) {
          skipNextPage = false
          return
        }
        void sdk.page({
          properties: { url: window.location.origin + e.urlAfterRedirects },
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

/**
 * Read the SDK anonymous-id cookie from the inbound request. Returns the raw
 * value when present so it can be passed to `forRequest({ profile })` for
 * cross-request profile continuity.
 */
function readAnonymousId(request: Request): string | undefined {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    if (trimmed.slice(0, eq) === ANONYMOUS_ID_COOKIE) return trimmed.slice(eq + 1)
  }
  return undefined
}

async function createServerOptimization(
  config: NgContentfulOptimizationConfig,
): Promise<NodeContentfulOptimizationType> {
  const { default: NodeContentfulOptimization } = await import('@contentful/optimization-node')
  return new NodeContentfulOptimization(toSdkConstructorArgs(config))
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
  readonly snapshot: OptimizationSnapshot
  readonly profileId: string | undefined
  readonly canPersistProfile: boolean
}

async function computeSnapshot(
  sdk: NodeContentfulOptimizationType,
  request: Request,
  consentGranted: boolean,
  locale: string,
): Promise<ServerPreflightOutcome> {
  if (!consentGranted) {
    return {
      snapshot: { consent: false, locale },
      profileId: undefined,
      canPersistProfile: false,
    }
  }

  const anonymousId = readAnonymousId(request)
  const requestOptimization: CoreStatelessRequest = sdk.forRequest({
    consent: { events: true, persistence: true },
    locale,
    eventContext: createServerEventContext(request, locale),
    ...(anonymousId === undefined ? {} : { profile: { id: anonymousId } }),
  })
  const pageResult = await requestOptimization.page()
  if (!pageResult.accepted || !pageResult.data) {
    return {
      snapshot: { consent: false, locale },
      profileId: undefined,
      canPersistProfile: false,
    }
  }

  return {
    snapshot: {
      consent: true,
      persistenceConsent: requestOptimization.canPersistProfile,
      locale,
      data: pageResult.data,
    },
    profileId: pageResult.data.profile.id,
    canPersistProfile: requestOptimization.canPersistProfile,
  }
}

function persistAnonymousIdCookie(responseInit: ResponseInit, profileId: string): void {
  const headers =
    responseInit.headers instanceof Headers
      ? responseInit.headers
      : new Headers(responseInit.headers)
  headers.append('set-cookie', `${ANONYMOUS_ID_COOKIE}=${profileId}; Path=/; SameSite=Lax`)
  responseInit.headers = headers
}

async function runServerPreflight(): Promise<void> {
  const request = inject(REQUEST, { optional: true })
  if (!request) return

  const responseInit = inject(RESPONSE_INIT, { optional: true })
  const transferState = inject(TransferState)
  const config = inject(NG_CONTENTFUL_OPTIMIZATION_CONFIG)
  const contentful = inject(NgContentfulClient)

  const consentGranted = readConsentFromRequest(request)
  const sdk = await createServerOptimization(config)
  const baselineIds = [...new Set([...PAGES.home.ids, ...PAGES.pageTwo.ids])]
  const baselines = await contentful.fetchEntries(baselineIds)

  const outcome = await computeSnapshot(sdk, request, consentGranted, config.locale)

  if (outcome.canPersistProfile && outcome.profileId && responseInit) {
    persistAnonymousIdCookie(responseInit, outcome.profileId)
  }

  transferState.set<OptimizationSnapshot>(SERVER_OPTIMIZATION_KEY, outcome.snapshot)
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

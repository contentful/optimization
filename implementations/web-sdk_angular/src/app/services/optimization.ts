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
import {
  getPreviewPanelBridge,
  type PreviewPanelBridge,
} from '@contentful/optimization-web/bridge-support'
import type { ExperienceRequestState } from '@contentful/optimization-web/core-sdk'
import { hydrateOptimizationHandoff } from '@contentful/optimization-web/handoff'
import { createScopedLogger } from '@contentful/optimization-web/logger'
import {
  createWebSnapshotRuntime,
  type OptimizationSnapshot,
  type WebOptimizationRuntime,
} from '@contentful/optimization-web/runtime'
import type { Entry } from 'contentful'
import { PAGES } from 'e2e-web'
import { firstValueFrom, Observable, Subject } from 'rxjs'
import { filter, takeUntil } from 'rxjs/operators'
import type { NgContentfulOptimizationConfig } from '../config'
import {
  getOrCreateBaseClient,
  NG_CONTENTFUL_OPTIMIZATION_CONFIG,
  resolveLogLevel,
} from '../config'
import { fromSdkState, type SdkObservable } from '../utils'
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

async function hydrateSnapshotAndPromote(
  sdk: ContentfulOptimization,
  snapshot: OptimizationSnapshot | undefined,
  runtimeSignal: WritableSignal<WebOptimizationRuntime>,
): Promise<void> {
  if (!snapshot?.data) {
    runtimeSignal.set(sdk)
    return
  }
  try {
    await hydrateOptimizationHandoff(sdk, {
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      initialPageEvent: snapshot.consent === true ? 'skip' : 'emit',
      state: snapshot.data,
    })
  } catch (error: unknown) {
    hydrationLogger.warn('Failed to hydrate live SDK from SSR snapshot.', error)
  }
  runtimeSignal.set(sdk)
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

function toRxObservable<T>(source: SdkObservable<T>): Observable<T> {
  return new Observable((subscriber) => {
    const subscription = source.subscribe((value) => {
      subscriber.next(value)
    })

    return () => {
      subscription.unsubscribe()
    }
  })
}

function cancelSettlement(cancellation: Subject<void> | undefined): void {
  cancellation?.next()
  cancellation?.complete()
}

async function getSettledExperienceRequestState(
  sdk: ContentfulOptimization,
  hasAcceptedData: boolean,
  cancellation: Subject<void>,
): Promise<ExperienceRequestState | undefined> {
  if (!hasAcceptedData) return undefined

  const {
    states: { experienceRequestState },
  } = sdk
  const { current } = experienceRequestState
  if (current.status !== 'pending') return current

  return await firstValueFrom(
    toRxObservable(experienceRequestState).pipe(
      filter((state) => state.status !== 'pending'),
      takeUntil(cancellation),
    ),
    { defaultValue: undefined },
  )
}

function createSettledPresentationRuntime(
  state: ExperienceRequestState | undefined,
  appliedState: PreviewPanelBridge | undefined,
): WebOptimizationRuntime {
  if (state?.status !== 'success' || appliedState === undefined) {
    return createWebSnapshotRuntime()
  }

  const { changes, profile, selectedOptimizations } = appliedState
  return createWebSnapshotRuntime({
    data: {
      changes: changes.value,
      profile: profile.value,
      selectedOptimizations: selectedOptimizations.value,
    },
  })
}

/**
 * Single SDK service exposed to components. `runtime` swaps from the SSR
 * snapshot to the live {@link ContentfulOptimization} for actions and live
 * updates. `presentationRuntime` remains snapshot-backed and changes only
 * when a route's page request settles, so normal rendering never reads stale
 * live selections. Both runtimes satisfy {@link WebOptimizationRuntime};
 * browser-only APIs on a snapshot runtime are inert no-ops.
 */
@Injectable({ providedIn: 'root' })
export class NgContentfulOptimization {
  readonly runtime: Signal<WebOptimizationRuntime>
  readonly presentationRuntime: Signal<WebOptimizationRuntime>
  readonly consent: Signal<boolean | undefined>
  readonly profile: Signal<Profile | undefined>
  readonly selectedOptimizations: Signal<SelectedOptimizationArray | undefined>
  private readonly router = inject(Router)
  private readonly sdk: ContentfulOptimization | undefined
  private readonly appliedState: PreviewPanelBridge | undefined
  private readonly hydration: Promise<void>
  private readonly initialPageReady: Promise<void>
  private readonly presentationRuntimeSignal: WritableSignal<WebOptimizationRuntime>
  private latestPresentationRequest = 0
  private presentationSettlementCancellation: Subject<void> | undefined = undefined

  constructor() {
    const config = inject(NG_CONTENTFUL_OPTIMIZATION_CONFIG)
    const destroyRef = inject(DestroyRef)
    const transferState = inject(TransferState)
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID))
    const snapshot = transferState.get<OptimizationSnapshot | undefined>(
      SERVER_OPTIMIZATION_KEY,
      undefined,
    )

    const snapshotRuntime = createWebSnapshotRuntime(snapshot)
    const runtimeSignal = signal<WebOptimizationRuntime>(snapshotRuntime)
    this.presentationRuntimeSignal = signal(snapshotRuntime)
    this.runtime = runtimeSignal.asReadonly()
    this.presentationRuntime = this.presentationRuntimeSignal.asReadonly()
    this.consent = fromSdkState(() => runtimeSignal().states.consent)
    this.profile = fromSdkState(() => runtimeSignal().states.profile)
    this.selectedOptimizations = fromSdkState(() => runtimeSignal().states.selectedOptimizations)

    if (!isBrowser) {
      this.sdk = undefined
      this.appliedState = undefined
      this.hydration = Promise.resolve()
      this.initialPageReady = Promise.resolve()
      // Server render: the snapshot runtime satisfies the full seam. Reads
      // flow through `states.*`, resolvers/getMergeTagValue are pure, event
      // actions are inert dev-warn no-ops, and `tracking.*` is a NOOP object.
      return
    }

    const sdk = getOrCreateInstance(config)
    this.sdk = sdk
    this.appliedState = getPreviewPanelBridge(sdk)

    // Prime the live SDK with the server-computed snapshot before promoting
    // it to the runtime signal, so the first live render matches the SSR
    // HTML (same selectedOptimizations, same profile, same merge tags).
    // With no server data (consent denied or preflight skipped), the snapshot
    // runtime and the fresh live SDK already share the same initial state, so
    // we can swap immediately.
    this.hydration = hydrateSnapshotAndPromote(sdk, snapshot, runtimeSignal)

    if (config.previewPanel !== undefined) {
      attachPreviewPanelSafely(sdk, config)
    }

    // Page events fire on every route change. The first NavigationEnd after
    // hydration is skipped when the server preflight already emitted page()
    // for the same route (consent was granted server-side) — without this
    // skip, analytics double-counts the SSR landing page. Subsequent
    // navigations always emit.
    this.initialPageReady = firstValueFrom(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      ),
    ).then(async (event) => {
      if (snapshot?.consent !== true) await this.trackPage(event.urlAfterRedirects)
    })

    destroyRef.onDestroy(() => {
      this.latestPresentationRequest += 1
      cancelSettlement(this.presentationSettlementCancellation)
      sdk.destroy()
      instance = undefined
    })
  }

  async prepareRoute(url: string): Promise<void> {
    if (this.sdk === undefined || !this.router.navigated) return

    await this.initialPageReady
    await this.trackPage(url)
  }

  private async trackPage(url: string): Promise<void> {
    if (this.sdk === undefined) return
    const request = ++this.latestPresentationRequest
    cancelSettlement(this.presentationSettlementCancellation)
    const cancellation = new Subject<void>()
    this.presentationSettlementCancellation = cancellation

    try {
      await this.hydration
      if (request !== this.latestPresentationRequest) return

      const result = await this.sdk
        .page({ properties: { url: new URL(url, window.location.origin).href } })
        .catch(() => undefined)
      if (request !== this.latestPresentationRequest) return

      const state = await getSettledExperienceRequestState(
        this.sdk,
        result?.accepted === true && result.data !== undefined,
        cancellation,
      )
      if (request !== this.latestPresentationRequest) return

      this.presentationRuntimeSignal.set(createSettledPresentationRuntime(state, this.appliedState))
    } finally {
      if (this.presentationSettlementCancellation === cancellation) {
        this.presentationSettlementCancellation = undefined
      }
      cancellation.complete()
    }
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

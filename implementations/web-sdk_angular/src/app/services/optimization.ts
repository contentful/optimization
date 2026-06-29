import { isPlatformBrowser } from '@angular/common'
import {
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  provideAppInitializer,
  REQUEST,
  RESPONSE_INIT,
  signal,
  TransferState,
  type EnvironmentProviders,
  type Signal,
} from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import type NodeContentfulOptimizationType from '@contentful/optimization-node'
import type { OptimizationData } from '@contentful/optimization-node/api-schemas'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import type {
  CoreStatelessRequest,
  UniversalEventBuilderArgs,
} from '@contentful/optimization-node/core-sdk'
import ContentfulOptimization from '@contentful/optimization-web'
import {
  isResolvedContentfulEntry,
  type Profile,
  type SelectedOptimizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { Entry } from 'contentful'
import { PAGES } from 'e2e-web'
import { filter } from 'rxjs/operators'
import type { NgContentfulOptimizationConfig } from '../config'
import {
  getOrCreateBaseClient,
  NG_CONTENTFUL_OPTIMIZATION_CONFIG,
  resolveLogLevel,
} from '../config'
import {
  SERVER_BASELINES_KEY,
  SERVER_OPTIMIZATION_KEY,
  SERVER_RESOLVED_ENTRIES_KEY,
  type ResolvedEntryData,
  type ServerHandoff,
} from '../transfer-state-keys'
import { fromSdkState } from '../utils'
import { readConsentFromRequest } from './consent'
import { NgContentfulClient } from './contentful-client'
import { resolveEntryMergeTags } from './merge-tags'

type NgContentfulOptimizationInstance = ContentfulOptimization

/**
 * Runtime context exposed by the {@link NgContentfulOptimization} service.
 * The `sdk` here is the **browser** SDK (`@contentful/optimization-web`),
 * which reads `localStorage` at construction time and therefore cannot be
 * instantiated server-side. Discriminating on `platform` lets callers branch
 * on the runtime without dereferencing an optional chain.
 *
 * The **Node** SDK (`@contentful/optimization-node`) does run server-side,
 * but it is intentionally not surfaced through this service — it is owned by
 * the preflight at the bottom of this file and only its **results** cross
 * into the browser bundle via `TransferState`.
 */
type NgContentfulOptimizationContext =
  | { readonly platform: 'server' }
  | { readonly platform: 'browser'; readonly sdk: NgContentfulOptimizationInstance }

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

let instance: NgContentfulOptimizationInstance | undefined = undefined
let attachmentStarted = false

async function attachPreviewPanel(
  sdk: NgContentfulOptimizationInstance,
  config: NgContentfulOptimizationConfig,
): Promise<void> {
  if (attachmentStarted) return
  attachmentStarted = true
  try {
    const contentfulClient = getOrCreateBaseClient(config)
    const { default: attach } = await import('@contentful/optimization-web-preview-panel')
    await attach({
      contentful: contentfulClient,
      optimization: sdk,
      nonce: config.previewPanel?.nonce,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('already been attached')) throw err
  }
}

function getOrCreateInstance(
  config: NgContentfulOptimizationConfig,
): NgContentfulOptimizationInstance {
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
 * Single SDK service exposed to components. On the browser it owns a real
 * {@link ContentfulOptimization} instance; on the server it surfaces the SSR
 * handoff so templates render the personalised state without ever touching the
 * Web SDK (which would crash on `localStorage`).
 */
@Injectable({ providedIn: 'root' })
export class NgContentfulOptimization {
  readonly context: NgContentfulOptimizationContext
  readonly consent: Signal<boolean | undefined>
  readonly profile: Signal<Profile | undefined>
  readonly selectedOptimizations: Signal<SelectedOptimizationArray | undefined>

  constructor() {
    const config = inject(NG_CONTENTFUL_OPTIMIZATION_CONFIG)
    const router = inject(Router)
    const destroyRef = inject(DestroyRef)
    const transferState = inject(TransferState)
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID))
    const handoff = transferState.get(SERVER_OPTIMIZATION_KEY, undefined)

    if (!isBrowser) {
      // Seed the read-only signals from the SSR handoff so server-rendered
      // templates reflect the same consent/profile state the server preflight
      // observed. Without this, JS-disabled clients would see "undefined" /
      // "0 active optimizations" in the Utilities panel even though the entry
      // markup is fully personalised.
      this.context = { platform: 'server' }
      this.consent = signal<boolean | undefined>(handoff?.consent).asReadonly()
      this.profile = signal<Profile | undefined>(handoff?.profile).asReadonly()
      this.selectedOptimizations = signal<SelectedOptimizationArray | undefined>(
        handoff?.selectedOptimizations,
      ).asReadonly()
      return
    }

    const sdk = getOrCreateInstance(config)
    this.context = { platform: 'browser', sdk }

    if (config.previewPanel !== undefined) {
      void attachPreviewPanel(sdk, config)
    }

    this.consent = fromSdkState(sdk.states.consent)
    this.profile = fromSdkState(sdk.states.profile)
    this.selectedOptimizations = fromSdkState(sdk.states.selectedOptimizations)

    // Page events fire on every route change. The first NavigationEnd after
    // hydration is skipped when the server preflight already emitted page()
    // for the same route (consent was granted server-side) — without this
    // skip, analytics double-counts the SSR landing page. Subsequent
    // navigations always emit.
    let skipNextPage = handoff?.consent ?? false
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
      attachmentStarted = false
    })
  }

  /**
   * Run an SDK side-effect on the browser. Returns the callback's value on the
   * browser branch, and `undefined` on the server (where there is no SDK to
   * call). Lets call sites avoid an `if (context.platform === 'browser')`
   * narrowing dance for fire-and-forget toggles.
   */
  ifBrowser<T>(fn: (sdk: NgContentfulOptimizationInstance) => T): T | undefined {
    return this.context.platform === 'browser' ? fn(this.context.sdk) : undefined
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
 * Outcome of the server-side preflight for one SSR request. Discriminated on
 * `consentGranted` so callers either get the full personalization context or
 * a "no SDK work happened" branch — never a half-populated value.
 */
type ServerOptimizationData =
  | { readonly consentGranted: false }
  | {
      readonly consentGranted: true
      readonly data: OptimizationData
      readonly profileId: string
      readonly canPersistProfile: boolean
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

async function getServerOptimizationData(
  sdk: NodeContentfulOptimizationType,
  request: Request,
  consentGranted: boolean,
  locale: string,
): Promise<ServerOptimizationData> {
  if (!consentGranted) return { consentGranted: false }

  const anonymousId = readAnonymousId(request)
  const requestOptimization: CoreStatelessRequest = sdk.forRequest({
    consent: { events: true, persistence: true },
    locale,
    eventContext: createServerEventContext(request, locale),
    ...(anonymousId === undefined ? {} : { profile: { id: anonymousId } }),
  })
  const pageResult = await requestOptimization.page()
  if (!pageResult.accepted) return { consentGranted: false }
  const data: OptimizationData | undefined = pageResult.data
  if (!data) return { consentGranted: false }

  return {
    consentGranted: true,
    data,
    profileId: data.profile.id,
    canPersistProfile: requestOptimization.canPersistProfile,
  }
}

/**
 * Resolve baselines against the SSR `selectedOptimizations`, then walk each
 * rich-text field and substitute inline merge-tag entries using the SDK's
 * `getMergeTagValue`. Shipping fully-resolved entries through `TransferState`
 * lets JS-disabled clients see the variant content AND the personalised merge
 * tags on first paint, not just the placeholder text.
 *
 * Nested entries (`fields.nested[]`) often appear only on the *resolved*
 * variant rather than on the baseline, so we recurse after each
 * `resolveOptimizedEntry` call to cover per-level Personalization
 * assignments inside the chosen variant.
 */
function resolveServerEntries(
  sdk: NodeContentfulOptimizationType,
  baselines: readonly Entry[],
  selectedOptimizations: OptimizationData['selectedOptimizations'],
  profile: Profile | undefined,
): Record<string, ResolvedEntryData> {
  const resolved: Record<string, ResolvedEntryData> = {}
  const queue: Entry[] = [...baselines]
  for (let entry = queue.shift(); entry !== undefined; entry = queue.shift()) {
    if (Object.hasOwn(resolved, entry.sys.id)) continue
    const result = sdk.resolveOptimizedEntry(entry, selectedOptimizations)
    const entryWithMergeTags = profile
      ? resolveEntryMergeTags(result.entry, (target) => sdk.getMergeTagValue(target, profile))
      : result.entry
    resolved[entry.sys.id] = { ...result, entry: entryWithMergeTags }
    const nested: unknown = entryWithMergeTags.fields.nested
    if (Array.isArray(nested)) {
      for (const child of nested) {
        if (isResolvedContentfulEntry(child)) queue.push(child)
      }
    }
  }
  return resolved
}

function persistAnonymousIdCookie(responseInit: ResponseInit, profileId: string): void {
  const headers =
    responseInit.headers instanceof Headers
      ? responseInit.headers
      : new Headers(responseInit.headers)
  headers.append('set-cookie', `${ANONYMOUS_ID_COOKIE}=${profileId}; Path=/; SameSite=Lax`)
  responseInit.headers = headers
}

function stampServerHandoff(
  transferState: TransferState,
  serverData: ServerOptimizationData,
  baselines: readonly Entry[],
  resolvedEntries: Record<string, ResolvedEntryData>,
): void {
  const handoff: ServerHandoff = serverData.consentGranted
    ? {
        consent: true,
        profile: serverData.data.profile,
        profileId: serverData.profileId,
        selectedOptimizations: serverData.data.selectedOptimizations,
      }
    : { consent: false }
  transferState.set<ServerHandoff>(SERVER_OPTIMIZATION_KEY, handoff)
  transferState.set<Record<string, Entry>>(
    SERVER_BASELINES_KEY,
    Object.fromEntries(baselines.map((baseline) => [baseline.sys.id, baseline])),
  )
  transferState.set<Record<string, ResolvedEntryData>>(SERVER_RESOLVED_ENTRIES_KEY, resolvedEntries)
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

  const serverData = await getServerOptimizationData(sdk, request, consentGranted, config.locale)

  if (serverData.consentGranted && serverData.canPersistProfile && responseInit) {
    persistAnonymousIdCookie(responseInit, serverData.profileId)
  }

  const resolvedEntries = resolveServerEntries(
    sdk,
    baselines,
    serverData.consentGranted ? serverData.data.selectedOptimizations : [],
    serverData.consentGranted ? serverData.data.profile : undefined,
  )
  stampServerHandoff(transferState, serverData, baselines, resolvedEntries)
}

/**
 * Wires the server-side SDK preflight into Angular's application
 * initializers. Imported from `app.config.server.ts`.
 */
export function provideServerOptimizationInitializer(): EnvironmentProviders {
  return provideAppInitializer(runServerPreflight)
}

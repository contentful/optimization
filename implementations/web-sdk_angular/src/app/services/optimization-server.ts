import type { TransferState } from '@angular/core'
import type ContentfulOptimization from '@contentful/optimization-node'
import type { OptimizationData } from '@contentful/optimization-node/api-schemas'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import type { CoreStatelessRequest } from '@contentful/optimization-node/core-sdk'
import type { Entry } from 'contentful'
import type { NgContentfulOptimizationConfig } from '../config'
import { resolveLogLevel } from '../config'
import {
  SERVER_OPTIMIZATION_KEY,
  SERVER_RESOLVED_ENTRIES_KEY,
  type ResolvedEntryHandoff,
  type ServerHandoff,
} from '../transfer-state-keys'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

/**
 * Reads a cookie value out of a Web `Request`. Mirrors the convention the
 * `nextjs-sdk_ssr` reference uses for the `app-personalization-consent` and
 * anonymous-id cookies.
 */
function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1)
  }
  return undefined
}

/**
 * Construct the Node SDK instance. Dynamic-imported by the caller so the Node
 * SDK and its Node-only dependencies stay out of the browser bundle.
 */
export async function createServerOptimization(
  config: NgContentfulOptimizationConfig,
): Promise<ContentfulOptimization> {
  const { default: NodeContentfulOptimization } = await import('@contentful/optimization-node')
  return new NodeContentfulOptimization({
    clientId: config.clientId,
    environment: config.environment,
    logLevel: resolveLogLevel(config.logLevel),
    locale: config.locale,
    app: config.app,
    api: {
      insightsBaseUrl: config.insightsBaseUrl,
      experienceBaseUrl: config.experienceBaseUrl,
    },
  })
}

export interface ServerOptimizationData {
  readonly data: OptimizationData | undefined
  readonly requestOptimization: CoreStatelessRequest | undefined
  readonly consentGranted: boolean
  readonly anonymousId: string | undefined
  readonly profileId: string | undefined
  readonly canPersistProfile: boolean
}

/**
 * Run the SDK preflight for a single SSR request: bind the Node SDK to the
 * inbound request's consent + anonymous-id cookies and emit the initial page
 * event. Returns the resulting OptimizationData (selected optimizations,
 * profile) for downstream resolution and TransferState handoff.
 */
export async function getServerOptimizationData(
  sdk: ContentfulOptimization,
  request: Request,
  locale: string,
): Promise<ServerOptimizationData> {
  const consentGranted = readCookie(request, APP_PERSONALIZATION_CONSENT_COOKIE) === 'granted'
  const anonymousId = readCookie(request, ANONYMOUS_ID_COOKIE)

  if (!consentGranted) {
    return {
      data: undefined,
      requestOptimization: undefined,
      consentGranted,
      anonymousId,
      profileId: anonymousId,
      canPersistProfile: false,
    }
  }

  const requestOptimization = sdk.forRequest({
    consent: { events: true, persistence: true },
    locale,
    ...(anonymousId ? { profile: { id: anonymousId } } : {}),
  })
  const data = await requestOptimization.page()

  return {
    data,
    requestOptimization,
    consentGranted,
    anonymousId,
    profileId: data?.profile.id ?? requestOptimization.profile?.id,
    canPersistProfile: requestOptimization.canPersistProfile,
  }
}

/**
 * Resolve baseline entries against the server-side `selectedOptimizations`
 * snapshot and return a TransferState-ready map keyed by baseline entry id.
 */
export function resolveServerEntries(
  sdk: ContentfulOptimization,
  baselines: readonly Entry[],
  selectedOptimizations: OptimizationData['selectedOptimizations'] | undefined,
): Record<string, ResolvedEntryHandoff> {
  const resolved: Record<string, ResolvedEntryHandoff> = {}
  for (const baseline of baselines) {
    const result = sdk.resolveOptimizedEntry(baseline, selectedOptimizations)
    resolved[baseline.sys.id] = {
      baseline,
      resolvedEntry: result.entry,
      optimizationId: result.selectedOptimization?.experienceId,
      variantIndex: result.selectedOptimization?.variantIndex,
      sticky: result.selectedOptimization?.sticky,
    }
  }
  return resolved
}

/**
 * Persist the SDK anonymous-id back to the client via Set-Cookie. Browser
 * pages that hydrate after this read the cookie via the Web SDK on first
 * `identify()`/`page()` so the same profile is observed across runtimes.
 */
export function persistAnonymousIdCookie(responseInit: ResponseInit, profileId: string): void {
  const headers =
    responseInit.headers instanceof Headers
      ? responseInit.headers
      : new Headers(responseInit.headers)
  headers.append('set-cookie', `${ANONYMOUS_ID_COOKIE}=${profileId}; Path=/; SameSite=Lax`)
  responseInit.headers = headers
}

/**
 * Stamp the server preflight + per-entry resolution into TransferState so the
 * browser hydration step can avoid duplicate fetches and re-resolutions.
 */
export function stampServerHandoff(
  transferState: TransferState,
  serverData: ServerOptimizationData,
  resolvedEntries: Record<string, ResolvedEntryHandoff>,
): void {
  const handoff: ServerHandoff = {
    consent: serverData.consentGranted,
    profileId: serverData.profileId,
    profile: serverData.data?.profile,
    selectedOptimizations: serverData.data?.selectedOptimizations,
  }
  transferState.set<ServerHandoff>(SERVER_OPTIMIZATION_KEY, handoff)
  transferState.set<Record<string, ResolvedEntryHandoff>>(
    SERVER_RESOLVED_ENTRIES_KEY,
    resolvedEntries,
  )
}

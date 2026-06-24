import type { TransferState } from '@angular/core'
import type ContentfulOptimization from '@contentful/optimization-node'
import type { OptimizationData } from '@contentful/optimization-node/api-schemas'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
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
 * anonymous-id cookies. Returns `null` when the cookie is absent so callers
 * can branch on a single contract instead of an `undefined` union.
 */
function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1)
  }
  return null
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

/**
 * Outcome of the server-side preflight for one SSR request. Discriminated on
 * `consentGranted` so callers either get the full personalization context or
 * a "no SDK work happened" branch — never a half-populated value.
 */
export type ServerOptimizationData =
  | {
      readonly consentGranted: false
    }
  | {
      readonly consentGranted: true
      readonly data: OptimizationData
      readonly profileId: string
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
  if (!consentGranted) return { consentGranted: false }

  const anonymousId = readCookie(request, ANONYMOUS_ID_COOKIE)
  const requestOptimization = sdk.forRequest({
    consent: { events: true, persistence: true },
    locale,
    ...(anonymousId === null ? {} : { profile: { id: anonymousId } }),
  })
  const data = await requestOptimization.page()
  if (!data) return { consentGranted: false }

  return {
    consentGranted: true,
    data,
    profileId: data.profile.id,
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
  selectedOptimizations: OptimizationData['selectedOptimizations'],
): Record<string, ResolvedEntryHandoff> {
  const resolved: Record<string, ResolvedEntryHandoff> = {}
  for (const baseline of baselines) {
    const result = sdk.resolveOptimizedEntry(baseline, selectedOptimizations)
    resolved[baseline.sys.id] = {
      baseline,
      resolvedEntry: result.entry,
      selectedOptimization: result.selectedOptimization ?? null,
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
  const handoff: ServerHandoff = serverData.consentGranted
    ? {
        consent: true,
        profile: serverData.data.profile,
        profileId: serverData.profileId,
        selectedOptimizations: serverData.data.selectedOptimizations,
      }
    : { consent: false }
  transferState.set<ServerHandoff>(SERVER_OPTIMIZATION_KEY, handoff)
  transferState.set<Record<string, ResolvedEntryHandoff>>(
    SERVER_RESOLVED_ENTRIES_KEY,
    resolvedEntries,
  )
}

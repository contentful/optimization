import { inject, Injectable } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import ContentfulOptimization from '@contentful/optimization-web'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { createClient } from 'contentful'
import { Observable } from 'rxjs'
import { filter } from 'rxjs/operators'
import { type Config, CONFIG } from '../config/config.token'

export type OptimizationInstance = ContentfulOptimization

export function fromSdkObservable<T>(sdkObs: {
  subscribe: (fn: (v: T) => void) => { unsubscribe: () => void }
}): Observable<T> {
  return new Observable<T>((subscriber) => {
    const sub = sdkObs.subscribe((v) => {
      subscriber.next(v)
    })
    return () => {
      sub.unsubscribe()
    }
  })
}

function resolveLogLevel(raw: string): 'debug' | 'warn' | 'error' {
  if (raw === 'debug' || raw === 'warn' || raw === 'error') return raw
  return 'debug'
}

// Module-level variables guarantee single SDK instance and single panel attachment.
let instance: OptimizationInstance | undefined = undefined
let attachmentStarted = false

async function attachPreviewPanel(
  sdk: OptimizationInstance,
  contentfulClient: ReturnType<typeof createClient>,
): Promise<void> {
  if (attachmentStarted) return
  attachmentStarted = true
  try {
    const { default: attach } = await import('@contentful/optimization-web-preview-panel')
    await attach({ contentful: contentfulClient, optimization: sdk, nonce: undefined })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('already been attached')) throw err
  }
}

function createRawContentfulClient(config: Config): ReturnType<typeof createClient> {
  return createClient({
    accessToken: config.contentfulToken,
    environment: config.contentfulEnvironment,
    space: config.contentfulSpaceId,
    host: config.contentfulCdaHost,
    insecure: config.contentfulCdaHost.includes('localhost'),
    basePath: config.contentfulBasePath,
  })
}

function getOrCreateInstance(config: {
  clientId: string
  sdkEnvironment: string
  insightsBaseUrl: string
  experienceBaseUrl: string
  logLevel: string
}): OptimizationInstance {
  instance ??= new ContentfulOptimization({
    clientId: config.clientId,
    environment: config.sdkEnvironment,
    logLevel: resolveLogLevel(config.logLevel),
    autoTrackEntryInteraction: { views: true, clicks: true, hovers: true },
    locale: 'en-US',
    contentfulLocales: { default: 'en-US' },
    app: { name: 'ContentfulOptimization SDK - Angular Web Reference', version: '0.0.0' },
    api: {
      insightsBaseUrl: config.insightsBaseUrl,
      experienceBaseUrl: config.experienceBaseUrl,
    },
  })
  return instance
}

@Injectable({ providedIn: 'root' })
export class Optimization {
  readonly sdk: OptimizationInstance | undefined
  readonly error: Error | undefined
  readonly consent$: Observable<boolean | undefined>
  readonly profile$: Observable<unknown>
  readonly eventStream$: Observable<unknown>
  readonly booleanFlag$: Observable<unknown>
  readonly selectedOptimizations$: Observable<SelectedOptimizationArray | undefined>

  constructor() {
    const config = inject(CONFIG)
    const router = inject(Router)

    // Errors are stored rather than thrown so components can degrade gracefully.
    try {
      this.sdk = getOrCreateInstance(config)
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err))
    }

    if (config.enablePreviewPanel && this.sdk !== undefined) {
      void attachPreviewPanel(this.sdk, createRawContentfulClient(config))
    }

    this.consent$ =
      this.sdk !== undefined
        ? fromSdkObservable<boolean | undefined>(this.sdk.states.consent)
        : new Observable<boolean | undefined>((sub) => {
            sub.next(undefined)
          })

    this.profile$ =
      this.sdk !== undefined
        ? fromSdkObservable<unknown>(this.sdk.states.profile)
        : new Observable<unknown>((sub) => {
            sub.next(undefined)
          })

    this.eventStream$ =
      this.sdk !== undefined
        ? fromSdkObservable<unknown>(this.sdk.states.eventStream)
        : new Observable<unknown>()

    this.selectedOptimizations$ =
      this.sdk !== undefined
        ? fromSdkObservable<SelectedOptimizationArray | undefined>(
            this.sdk.states.selectedOptimizations,
          )
        : new Observable<SelectedOptimizationArray | undefined>((sub) => {
            sub.next(undefined)
          })

    // Subscribing to a flag automatically emits a component view event — no explicit tracking needed.
    this.booleanFlag$ =
      this.sdk !== undefined
        ? fromSdkObservable<unknown>(this.sdk.states.flag('boolean'))
        : new Observable<unknown>((sub) => {
            sub.next(undefined)
          })

    // Page events are the most critical call in the integration — the SDK uses the current URL
    // to resolve which experiences and variants apply to the user. Without this, personalisation
    // does not work. Must fire on every route change including the initial load, and fires
    // regardless of consent state — that is SDK behaviour, not something the app controls.
    router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        void this.sdk?.page({ properties: { url: e.urlAfterRedirects } })
      })
  }

  setConsent(value: boolean): void {
    this.sdk?.consent(value)
  }

  identify(): void {
    void this.sdk?.identify({ userId: 'charles', traits: { identified: true } })
  }

  reset(): void {
    this.sdk?.reset()
    // reset() does not auto-emit a page event; fire one immediately after.
    void this.sdk?.page()
  }
}

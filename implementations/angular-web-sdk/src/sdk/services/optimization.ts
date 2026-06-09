import { inject, Injectable } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NavigationEnd, Router } from '@angular/router'
import ContentfulOptimization from '@contentful/optimization-web'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { Profile } from '@contentful/optimization-web/api-schemas'
import { createClient } from 'contentful'
import { Observable } from 'rxjs'
import { filter, map } from 'rxjs/operators'
import type { NgContentfulOptimizationConfig } from '../config'
import { NG_CONTENTFUL_OPTIMIZATION_CONFIG } from '../config'

export type NgContentfulOptimizationInstance = ContentfulOptimization

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

function resolveLogLevel(raw: string | undefined): 'debug' | 'warn' | 'error' {
  if (raw === 'debug' || raw === 'warn' || raw === 'error') return raw
  return 'debug'
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
    const contentfulClient = createClient({
      accessToken: config.contentful.accessToken,
      environment: config.contentful.environment,
      space: config.contentful.spaceId,
      host: config.contentful.cdaHost,
      insecure: config.contentful.cdaHost.includes('localhost'),
      basePath: config.contentful.basePath,
    })
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
    clientId: config.clientId,
    environment: config.environment,
    logLevel: resolveLogLevel(config.logLevel),
    autoTrackEntryInteraction: config.autoTrackEntryInteraction ?? {
      views: true,
      clicks: true,
      hovers: true,
    },
    locale: config.locale,
    contentfulLocales: config.contentfulLocales,
    app: config.app,
    api: {
      insightsBaseUrl: config.insightsBaseUrl,
      experienceBaseUrl: config.experienceBaseUrl,
    },
  })
  return instance
}

@Injectable({ providedIn: 'root' })
export class NgContentfulOptimization {
  readonly sdk: NgContentfulOptimizationInstance | undefined
  readonly error: Error | undefined
  readonly consent$: Observable<boolean | undefined>
  readonly profile$: Observable<Profile | undefined>
  readonly eventStream$: Observable<unknown>
  readonly booleanFlag$: Observable<unknown>
  readonly selectedOptimizations$: Observable<SelectedOptimizationArray | undefined>
  readonly selectedOptimizations: ReturnType<typeof toSignal<SelectedOptimizationArray | undefined>>
  readonly profile: ReturnType<typeof toSignal<Profile | undefined>>

  constructor() {
    const config = inject(NG_CONTENTFUL_OPTIMIZATION_CONFIG)
    const router = inject(Router)

    try {
      this.sdk = getOrCreateInstance(config)
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err))
    }

    if (config.previewPanel !== undefined && this.sdk !== undefined) {
      void attachPreviewPanel(this.sdk, config)
    }

    this.consent$ =
      this.sdk !== undefined
        ? fromSdkObservable<boolean | undefined>(this.sdk.states.consent)
        : new Observable<boolean | undefined>((sub) => {
            sub.next(undefined)
          })

    this.profile$ =
      this.sdk !== undefined
        ? fromSdkObservable<unknown>(this.sdk.states.profile).pipe(
            map((raw) => {
              const result = Profile.safeParse(raw)
              return result.success ? result.data : undefined
            }),
          )
        : new Observable<Profile | undefined>((sub) => {
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

    this.selectedOptimizations = toSignal(this.selectedOptimizations$)
    this.profile = toSignal(this.profile$)

    this.booleanFlag$ =
      this.sdk !== undefined
        ? fromSdkObservable<unknown>(this.sdk.states.flag('boolean'))
        : new Observable<unknown>((sub) => {
            sub.next(undefined)
          })

    // Page events must fire on every route change including the initial load.
    // The SDK uses the current URL to resolve which experiences apply to the user.
    router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        void this.sdk?.page({ properties: { url: e.urlAfterRedirects } })
      })
  }

  setConsent(value: boolean): void {
    this.sdk?.consent(value)
  }

  identify(userId: string, traits?: Record<string, string | number | boolean | null>): void {
    void this.sdk?.identify({ userId, traits })
  }

  reset(): void {
    this.sdk?.reset()
    void this.sdk?.page()
  }
}

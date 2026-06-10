import { inject, Injectable, type OnDestroy } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NavigationEnd, Router } from '@angular/router'
import ContentfulOptimization from '@contentful/optimization-web'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { Profile } from '@contentful/optimization-web/api-schemas'
import { createClient } from 'contentful'
import { Observable, type Subscription } from 'rxjs'
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
export class NgContentfulOptimization implements OnDestroy {
  readonly sdk: NgContentfulOptimizationInstance
  readonly consent$: Observable<boolean | undefined>
  readonly profile$: Observable<Profile | undefined>
  readonly eventStream$: Observable<unknown>
  readonly booleanFlag$: Observable<unknown>
  readonly selectedOptimizations$: Observable<SelectedOptimizationArray | undefined>
  readonly selectedOptimizations: ReturnType<typeof toSignal<SelectedOptimizationArray | undefined>>
  readonly profile: ReturnType<typeof toSignal<Profile | undefined>>

  private readonly routerSubscription: Subscription

  constructor() {
    const config = inject(NG_CONTENTFUL_OPTIMIZATION_CONFIG)
    const router = inject(Router)

    this.sdk = getOrCreateInstance(config)

    if (config.previewPanel !== undefined) {
      void attachPreviewPanel(this.sdk, config)
    }

    this.consent$ = fromSdkObservable<boolean | undefined>(this.sdk.states.consent)

    this.profile$ = fromSdkObservable<unknown>(this.sdk.states.profile).pipe(
      map((raw) => {
        const result = Profile.safeParse(raw)
        return result.success ? result.data : undefined
      }),
    )

    this.eventStream$ = fromSdkObservable<unknown>(this.sdk.states.eventStream)

    this.selectedOptimizations$ = fromSdkObservable<SelectedOptimizationArray | undefined>(
      this.sdk.states.selectedOptimizations,
    )

    this.selectedOptimizations = toSignal(this.selectedOptimizations$)
    this.profile = toSignal(this.profile$)

    this.booleanFlag$ = fromSdkObservable<unknown>(this.sdk.states.flag('boolean'))

    // Page events must fire on every route change including the initial load.
    // The SDK uses the current URL to resolve which experiences apply to the user.
    this.routerSubscription = router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        void this.sdk.page({ properties: { url: e.urlAfterRedirects } })
      })
  }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe()
    this.sdk.destroy()
    instance = undefined
    attachmentStarted = false
  }
}

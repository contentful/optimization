import { isPlatformBrowser } from '@angular/common'
import { inject, Injectable, PLATFORM_ID, signal, type OnDestroy, type Signal } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import ContentfulOptimization from '@contentful/optimization-web'
import type { Profile, SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type { NgContentfulOptimizationConfig } from '../config'
import {
  getOrCreateBaseClient,
  NG_CONTENTFUL_OPTIMIZATION_CONFIG,
  resolveLogLevel,
} from '../config'
import { fromSdkState } from '../utils'

export type NgContentfulOptimizationInstance = ContentfulOptimization

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
    clientId: config.clientId,
    environment: config.environment,
    logLevel: resolveLogLevel(config.logLevel),
    autoTrackEntryInteraction: config.autoTrackEntryInteraction ?? {
      views: true,
      clicks: true,
      hovers: true,
    },
    locale: config.locale,
    app: config.app,
    api: {
      insightsBaseUrl: config.insightsBaseUrl,
      experienceBaseUrl: config.experienceBaseUrl,
    },
  })
  return instance
}

/**
 * Browser-only SDK service. The Web SDK constructor touches `localStorage` at
 * construction time, so on the server we leave `sdk` as `undefined` and skip
 * SDK side effects. Components dereferencing `sdk?.` are no-ops during SSR;
 * the same components run normally after hydration once the browser SDK is
 * constructed here.
 */
@Injectable({ providedIn: 'root' })
export class NgContentfulOptimization implements OnDestroy {
  readonly sdk: NgContentfulOptimizationInstance | undefined
  readonly consent: Signal<boolean | undefined>
  readonly profile: Signal<Profile | undefined>
  readonly selectedOptimizations: Signal<SelectedOptimizationArray | undefined>

  private readonly routerSubscription: Subscription | undefined

  constructor() {
    const config = inject(NG_CONTENTFUL_OPTIMIZATION_CONFIG)
    const router = inject(Router)
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID))

    if (!isBrowser) {
      this.sdk = undefined
      this.consent = signal<boolean | undefined>(undefined).asReadonly()
      this.profile = signal<Profile | undefined>(undefined).asReadonly()
      this.selectedOptimizations = signal<SelectedOptimizationArray | undefined>(
        undefined,
      ).asReadonly()
      return
    }

    this.sdk = getOrCreateInstance(config)

    if (config.previewPanel !== undefined) {
      void attachPreviewPanel(this.sdk, config)
    }

    this.consent = fromSdkState(this.sdk.states.consent)
    this.profile = fromSdkState(this.sdk.states.profile)
    this.selectedOptimizations = fromSdkState(this.sdk.states.selectedOptimizations)

    // Page events must fire on every route change including the initial load.
    // The SDK uses the current URL to resolve which experiences apply to the user.
    this.routerSubscription = router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        void this.sdk?.page({
          properties: { url: window.location.origin + e.urlAfterRedirects },
        })
      })
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe()
    this.sdk?.destroy()
    instance = undefined
    attachmentStarted = false
  }
}

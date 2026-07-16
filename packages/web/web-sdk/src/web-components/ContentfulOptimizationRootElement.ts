import ContentfulOptimization from '../ContentfulOptimization'
import type { ContentfulConfig, ManagedEntryDescriptor } from '../core-sdk'
import type { ContentOptimizationHydrationMode } from '../handoff'
import {
  OPTIMIZED_ENTRY_HOST_DISPLAY,
  createOptimizationRootSdkBinding,
  disposeOptimizationRootSdkBinding,
  type OnStatesReady,
  type OptimizationRootSdk,
  type OptimizationRootSdkBinding,
  type OptimizationRootSdkConfig,
  type TrackEntryInteractionOptions,
} from '../presentation'

const ROOT_READY_EVENT = 'ctfl-root-ready'
const ROOT_ERROR_EVENT = 'ctfl-root-error'

type OptimizationRootContextSubscriber = (context: ContentfulOptimizationRootContext) => void

export interface ContentfulOptimizationRootContext {
  readonly error: Error | undefined
  readonly hydration: ContentOptimizationHydrationMode
  readonly rootLiveUpdatesEnabled: boolean
  readonly isSdkReady: boolean
  readonly isPreviewPanelOpen: boolean
  readonly sdk: ContentfulOptimization | undefined
}

export interface ContentfulOptimizationRootReadyEventDetail {
  readonly sdk: ContentfulOptimization
}

export interface ContentfulOptimizationRootErrorEventDetail {
  readonly error: Error
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function parseBooleanAttribute(value: string | null): boolean {
  return value !== null && value !== 'false'
}

function getGlobalSdk(): ContentfulOptimization | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.contentfulOptimization
}

export class ContentfulOptimizationRootElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['client-id', 'environment', 'hydration', 'live-updates', 'locale']
  }

  private apiOptions: OptimizationRootSdkConfig['api'] | undefined
  private context: ContentfulOptimizationRootContext = {
    error: undefined,
    hydration: 'client-only-hidden-until-ready',
    rootLiveUpdatesEnabled: false,
    isSdkReady: false,
    isPreviewPanelOpen: false,
    sdk: undefined,
  }
  private defaultOptions: OptimizationRootSdkConfig['defaults'] | undefined
  private contentfulOptions: ContentfulConfig | undefined
  private onStatesReadyHandler: OnStatesReady | undefined
  private previewPanelOpenSubscription: { unsubscribe: () => void } | undefined
  private prefetchManagedEntryDescriptors: readonly ManagedEntryDescriptor[] | undefined
  private sdkBinding: OptimizationRootSdkBinding | undefined
  private assignedSdk: ContentfulOptimization | undefined
  private readonly subscribers = new Set<OptimizationRootContextSubscriber>()
  private trackEntryInteractionOptions: TrackEntryInteractionOptions | undefined

  get clientId(): string | undefined {
    return this.getAttribute('client-id') ?? undefined
  }

  set clientId(value: string | undefined) {
    this.setOptionalAttribute('client-id', value)
  }

  get environment(): string | undefined {
    return this.getAttribute('environment') ?? undefined
  }

  set environment(value: string | undefined) {
    this.setOptionalAttribute('environment', value)
  }

  get locale(): string | undefined {
    return this.getAttribute('locale') ?? undefined
  }

  set locale(value: string | undefined) {
    this.setOptionalAttribute('locale', value)
  }

  get liveUpdates(): boolean {
    return parseBooleanAttribute(this.getAttribute('live-updates'))
  }

  set liveUpdates(value: boolean) {
    if (value) {
      this.setAttribute('live-updates', '')
      return
    }

    this.removeAttribute('live-updates')
  }

  get hydration(): ContentOptimizationHydrationMode {
    const value = this.getAttribute('hydration')

    return value === 'preserve-server' ? 'preserve-server' : 'client-only-hidden-until-ready'
  }

  set hydration(value: ContentOptimizationHydrationMode) {
    this.setAttribute('hydration', value)
  }

  get defaults(): OptimizationRootSdkConfig['defaults'] | undefined {
    return this.defaultOptions
  }

  set defaults(value: OptimizationRootSdkConfig['defaults'] | undefined) {
    this.defaultOptions = value
    this.reinitializeIfConnected()
  }

  get contentful(): ContentfulConfig | undefined {
    return this.contentfulOptions
  }

  set contentful(value: ContentfulConfig | undefined) {
    this.contentfulOptions = value
    this.reinitializeIfConnected()
  }

  get api(): OptimizationRootSdkConfig['api'] | undefined {
    return this.apiOptions
  }

  set api(value: OptimizationRootSdkConfig['api'] | undefined) {
    this.apiOptions = value
    this.reinitializeIfConnected()
  }

  get trackEntryInteraction(): TrackEntryInteractionOptions | undefined {
    return this.trackEntryInteractionOptions
  }

  set trackEntryInteraction(value: TrackEntryInteractionOptions | undefined) {
    this.trackEntryInteractionOptions = value
    this.reinitializeIfConnected()
  }

  get sdk(): ContentfulOptimization | undefined {
    return this.assignedSdk
  }

  set sdk(value: ContentfulOptimization | undefined) {
    this.assignedSdk = value
    this.reinitializeIfConnected()
  }

  get onStatesReady(): OnStatesReady | undefined {
    return this.onStatesReadyHandler
  }

  set onStatesReady(value: OnStatesReady | undefined) {
    this.onStatesReadyHandler = value
    this.reinitializeIfConnected()
  }

  get prefetchManagedEntries(): readonly ManagedEntryDescriptor[] | undefined {
    return this.prefetchManagedEntryDescriptors
  }

  set prefetchManagedEntries(value: readonly ManagedEntryDescriptor[] | undefined) {
    this.prefetchManagedEntryDescriptors = value
    this.prefetchManagedEntriesIfReady()
  }

  private setOptionalAttribute(name: string, value: string | undefined): void {
    if (value === undefined) {
      this.removeAttribute(name)
      return
    }

    this.setAttribute(name, value)
  }

  connectedCallback(): void {
    this.style.display ||= OPTIMIZED_ENTRY_HOST_DISPLAY

    this.initializeSdkBinding()
  }

  disconnectedCallback(): void {
    this.teardownSdkBinding()
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.isConnected) {
      return
    }

    if (name === 'hydration' || name === 'live-updates') {
      this.publishContext({
        hydration: this.hydration,
        rootLiveUpdatesEnabled: this.liveUpdates,
      })
      return
    }

    if (name === 'locale') {
      this.applyLocaleUpdate()
      return
    }

    this.initializeSdkBinding()
  }

  subscribeOptimizationContext(subscriber: OptimizationRootContextSubscriber): () => void {
    this.subscribers.add(subscriber)
    subscriber(this.context)

    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  private reinitializeIfConnected(): void {
    if (!this.isConnected) {
      return
    }

    this.initializeSdkBinding()
  }

  private initializeSdkBinding(): void {
    this.teardownSdkBinding()

    try {
      const providedSdk = this.assignedSdk ?? getGlobalSdk()
      const sdkBinding =
        providedSdk === undefined
          ? createOptimizationRootSdkBinding({
              config: this.createConfig(),
              createSdk: (config) => new ContentfulOptimization(config),
              onStatesReady: this.onStatesReadyHandler,
              trackEntryInteraction: this.trackEntryInteractionOptions,
            })
          : createOptimizationRootSdkBinding({
              onStatesReady: this.onStatesReadyHandler,
              sdk: providedSdk,
            })

      this.sdkBinding = sdkBinding
      const { sdk } = sdkBinding
      const isPreviewPanelOpen = this.bindPreviewPanelOpenState(sdk)
      this.publishContext({
        error: undefined,
        hydration: this.hydration,
        rootLiveUpdatesEnabled: this.liveUpdates,
        isSdkReady: true,
        isPreviewPanelOpen,
        sdk,
      })
      this.prefetchManagedEntriesIfReady()
      this.dispatchEvent(
        new CustomEvent<ContentfulOptimizationRootReadyEventDetail>(ROOT_READY_EVENT, {
          bubbles: true,
          composed: true,
          detail: { sdk },
        }),
      )
    } catch (error: unknown) {
      const normalizedError = toError(error)
      this.publishContext({
        error: normalizedError,
        isSdkReady: false,
        isPreviewPanelOpen: false,
        sdk: undefined,
      })
      this.dispatchRootError(normalizedError)
    }
  }

  private createConfig(): OptimizationRootSdkConfig {
    const { clientId } = this

    if (!clientId) {
      throw new Error('ctfl-optimization-root requires a client-id attribute or sdk property.')
    }

    return {
      api: this.apiOptions,
      clientId,
      contentful: this.contentfulOptions,
      defaults: this.defaultOptions,
      environment: this.environment,
      locale: this.locale,
    }
  }

  private bindPreviewPanelOpenState(sdk: OptimizationRootSdk): boolean {
    const {
      states: { previewPanelOpen },
    } = sdk
    const { current } = previewPanelOpen

    this.previewPanelOpenSubscription = previewPanelOpen.subscribe((isPreviewPanelOpen) => {
      this.publishContext({ isPreviewPanelOpen })
    })

    return current
  }

  private applyLocaleUpdate(): void {
    if (!this.sdkBinding?.ownsInstance || this.locale === undefined) {
      return
    }

    try {
      this.sdkBinding.sdk.setLocale(this.locale)
    } catch (error: unknown) {
      const normalizedError = toError(error)
      this.publishContext({ error: normalizedError })
      this.dispatchRootError(normalizedError)
    }
  }

  private teardownSdkBinding(): void {
    this.previewPanelOpenSubscription?.unsubscribe()
    this.previewPanelOpenSubscription = undefined
    disposeOptimizationRootSdkBinding(this.sdkBinding)
    this.sdkBinding = undefined
    this.publishContext({
      error: undefined,
      isSdkReady: false,
      isPreviewPanelOpen: false,
      sdk: undefined,
    })
  }

  private dispatchRootError(error: Error): void {
    this.dispatchEvent(
      new CustomEvent<ContentfulOptimizationRootErrorEventDetail>(ROOT_ERROR_EVENT, {
        bubbles: true,
        composed: true,
        detail: { error },
      }),
    )
  }

  private prefetchManagedEntriesIfReady(): void {
    const {
      context: { sdk },
      prefetchManagedEntryDescriptors: entries,
    } = this

    if (sdk === undefined || entries === undefined || entries.length === 0) {
      return
    }

    void sdk.prefetchManagedEntries(entries).catch((error: unknown) => {
      if (this.context.sdk !== sdk) {
        return
      }

      const normalizedError = toError(error)
      this.publishContext({ error: normalizedError })
      this.dispatchRootError(normalizedError)
    })
  }

  private publishContext(nextContext: Partial<ContentfulOptimizationRootContext>): void {
    this.context = {
      ...this.context,
      ...nextContext,
    }

    this.subscribers.forEach((subscriber) => {
      subscriber(this.context)
    })
  }
}

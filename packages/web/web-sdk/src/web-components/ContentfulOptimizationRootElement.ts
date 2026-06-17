import ContentfulOptimization from '../ContentfulOptimization'
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
  readonly rootLiveUpdatesEnabled: boolean
  readonly isSdkReady: boolean
  readonly isPreviewPanelOpen: boolean
  readonly sdk: OptimizationRootSdk | undefined
}

export interface ContentfulOptimizationRootReadyEventDetail {
  readonly sdk: OptimizationRootSdk
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

function getGlobalSdk(): OptimizationRootSdk | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.contentfulOptimization
}

export class ContentfulOptimizationRootElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['client-id', 'environment', 'live-updates', 'locale']
  }

  private apiOptions: OptimizationRootSdkConfig['api'] | undefined = undefined
  private context: ContentfulOptimizationRootContext = {
    error: undefined,
    rootLiveUpdatesEnabled: false,
    isSdkReady: false,
    isPreviewPanelOpen: false,
    sdk: undefined,
  }
  private defaultOptions: OptimizationRootSdkConfig['defaults'] | undefined = undefined
  private onStatesReadyHandler: OnStatesReady | undefined = undefined
  private previewPanelOpenSubscription: { unsubscribe: () => void } | undefined = undefined
  private sdkBinding: OptimizationRootSdkBinding | undefined = undefined
  private assignedSdk: OptimizationRootSdk | undefined = undefined
  private readonly subscribers = new Set<OptimizationRootContextSubscriber>()
  private trackEntryInteractionOptions: TrackEntryInteractionOptions | undefined = undefined

  get clientId(): string | undefined {
    return this.getAttribute('client-id') ?? undefined
  }

  set clientId(value: string | undefined) {
    if (value === undefined) {
      this.removeAttribute('client-id')
      return
    }

    this.setAttribute('client-id', value)
  }

  get environment(): string | undefined {
    return this.getAttribute('environment') ?? undefined
  }

  set environment(value: string | undefined) {
    if (value === undefined) {
      this.removeAttribute('environment')
      return
    }

    this.setAttribute('environment', value)
  }

  get locale(): string | undefined {
    return this.getAttribute('locale') ?? undefined
  }

  set locale(value: string | undefined) {
    if (value === undefined) {
      this.removeAttribute('locale')
      return
    }

    this.setAttribute('locale', value)
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

  get defaults(): OptimizationRootSdkConfig['defaults'] | undefined {
    return this.defaultOptions
  }

  set defaults(value: OptimizationRootSdkConfig['defaults'] | undefined) {
    this.defaultOptions = value
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

  get sdk(): OptimizationRootSdk | undefined {
    return this.assignedSdk
  }

  set sdk(value: OptimizationRootSdk | undefined) {
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

    if (name === 'live-updates') {
      this.publishContext({ rootLiveUpdatesEnabled: this.liveUpdates })
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
        rootLiveUpdatesEnabled: this.liveUpdates,
        isSdkReady: true,
        isPreviewPanelOpen,
        sdk,
      })
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
      this.dispatchEvent(
        new CustomEvent<ContentfulOptimizationRootErrorEventDetail>(ROOT_ERROR_EVENT, {
          bubbles: true,
          composed: true,
          detail: { error: normalizedError },
        }),
      )
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
      this.dispatchEvent(
        new CustomEvent<ContentfulOptimizationRootErrorEventDetail>(ROOT_ERROR_EVENT, {
          bubbles: true,
          composed: true,
          detail: { error: normalizedError },
        }),
      )
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

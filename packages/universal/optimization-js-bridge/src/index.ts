import type { Traits } from '@contentful/optimization-api-client/api-schemas'
import {
  type ConsentInput,
  CoreStateful,
  type CoreStatefulConfig,
  type CurrentStateTrackingResult,
  type EventEmissionResult,
  type ExperienceRequestState,
  resolveStatefulDefaults,
  shouldRememberStickyEntryViewResult,
  shouldSendStickyEntryView,
  signalFns,
  signals,
} from '@contentful/optimization-core'
import { isRecord } from '@contentful/optimization-core/api-schemas'
import {
  type AudienceDefinition,
  type ContentfulEntryCollection,
  createAudienceDefinitions,
  createExperienceDefinitions,
  createExperienceNameMap,
  type ExperienceDefinition,
  PreviewOverrideManager,
} from '@contentful/optimization-core/preview-support'
import { computePreviewModel, transformOverrides } from './previewStateHelpers'

type ResolveOptimizedEntryArgs = Parameters<CoreStateful['resolveOptimizedEntry']>
type ResolveOptimizedEntryEntry = ResolveOptimizedEntryArgs[0]
type ResolveOptimizedEntrySelections = ResolveOptimizedEntryArgs[1]
type GetMergeTagValueEntry = Parameters<CoreStateful['getMergeTagValue']>[0]
type CoreScreenPayload = Parameters<CoreStateful['screen']>[0]
type ScreenProperties = Parameters<CoreStateful['screen']>[0]['properties']
type TrackPayload = Parameters<CoreStateful['track']>[0]
type BridgeScreenPayload = { name: string; properties?: ScreenProperties; routeKey?: string }

type ProfileValue = typeof signals.profile.value
type ChangesValue = typeof signals.changes.value
type SelectedOptimizationsValue = typeof signals.selectedOptimizations.value
const DEFAULT_NATIVE_ALLOWED_EVENT_TYPES: NonNullable<CoreStatefulConfig['allowedEventTypes']> = [
  'identify',
  'screen',
]

// Native runtimes (iOS JavaScriptCore, Android QuickJS) install these callbacks
// on the JS engine's globalThis before the bridge is loaded. The bridge calls
// them to push state/event updates back into the native layer. `window` is NOT
// defined in QuickJS or JSC — only `globalThis` is universal across both
// engines plus any browser-style WebView consumer.
interface NativeGlobal {
  __nativeOnStateChange?: (json: string) => void
  __nativeOnEventEmitted?: (json: string) => void
  __nativeOnOverridesChanged?: (json: string) => void
  __nativeOnEventBlocked?: (json: string) => void
  __nativeOnFlagValueChanged?: (subscriptionId: string, json: string) => void
  __nativeOnQueueEvent?: (json: string) => void
  __bridge?: Bridge
}
const nativeGlobal = globalThis as typeof globalThis & NativeGlobal

type CoreQueuePolicy = NonNullable<CoreStatefulConfig['queuePolicy']>
type CoreQueueFlushPolicy = NonNullable<CoreQueuePolicy['flush']>
type CoreApiConfig = NonNullable<CoreStatefulConfig['api']>
type BridgeQueueFlushPolicy = Omit<
  CoreQueueFlushPolicy,
  'onCircuitOpen' | 'onFlushFailure' | 'onFlushRecovered'
>
type BridgeQueuePolicy = Omit<CoreQueuePolicy, 'flush' | 'onOfflineDrop'> & {
  flush?: BridgeQueueFlushPolicy
}

interface BridgeConfig {
  clientId: string
  environment: string
  api?: {
    experienceBaseUrl?: CoreApiConfig['experienceBaseUrl']
    insightsBaseUrl?: CoreApiConfig['insightsBaseUrl']
    enabledFeatures?: CoreApiConfig['enabledFeatures']
    preflight?: CoreApiConfig['preflight']
  }
  locale?: string
  logLevel?: CoreStatefulConfig['logLevel']
  allowedEventTypes?: CoreStatefulConfig['allowedEventTypes']
  queuePolicy?: BridgeQueuePolicy
  defaults?: {
    consent?: boolean
    persistenceConsent?: boolean
    profile?: ProfileValue
    changes?: ChangesValue
    selectedOptimizations?: SelectedOptimizationsValue
    anonymousId?: string
  }
}

interface BridgeState {
  profile: ProfileValue | null
  consent: boolean | undefined
  persistenceConsent: boolean | undefined
  canOptimize: boolean
  optimizationPossible: boolean
  experienceRequestState: ExperienceRequestState
  changes: ChangesValue | null
  locale: string | null
  selectedOptimizations: SelectedOptimizationsValue | null
}

interface TrackViewPayload {
  componentId: string
  viewId: string
  experienceId?: string
  optimizationContextId?: string
  variantIndex: number
  viewDurationMs: number
  sticky?: boolean
  stickyTrackingKey?: string
}

interface TrackClickPayload {
  componentId: string
  experienceId?: string
  optimizationContextId?: string
  variantIndex: number
}

interface Bridge {
  initialize: (config: BridgeConfig) => void
  identify: (
    payload: { userId: string; traits?: Traits },
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ) => void
  page: (
    payload: Record<string, unknown>,
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ) => void
  getProfile: () => string | null
  getState: () => string
  hasConsent: (method: string) => boolean
  destroy: () => void

  // Async with callbacks
  screen: (
    payload: BridgeScreenPayload,
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ) => void
  trackCurrentScreen: (
    payload: BridgeScreenPayload,
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ) => void
  track: (
    payload: TrackPayload,
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ) => void
  flush: (onSuccess: (json: string) => void, onError: (error: string) => void) => void
  trackView: (
    payload: TrackViewPayload,
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ) => void
  trackClick: (
    payload: TrackClickPayload,
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ) => void

  // Synchronous
  consent: (accept: ConsentInput) => void
  setLocale: (locale: string) => string | null
  reset: () => void
  // Native code passes JSON-shaped objects; the bridge trusts the shape and
  // forwards them straight to core. TypeScript types here document the
  // expected payload, but no runtime narrowing is performed.
  resolveOptimizedEntry: (
    baseline: ResolveOptimizedEntryEntry,
    selectedOptimizations?: ResolveOptimizedEntrySelections,
  ) => string
  getMergeTagValue: (mergeTagEntry: GetMergeTagValueEntry) => string | null
  getFlag: (name: string) => string
  observeFlag: (subscriptionId: string, name: string) => void
  unobserveFlag: (subscriptionId: string) => void
  setOnline: (isOnline: boolean) => void

  // Preview panel
  setPreviewPanelOpen: (open: boolean) => void
  overrideAudience: (audienceId: string, qualified: boolean, experienceIds: string[]) => void
  overrideVariant: (experienceId: string, variantIndex: number) => void
  resetAudienceOverride: (audienceId: string) => void
  resetVariantOverride: (experienceId: string) => void
  resetAllOverrides: () => void
  loadDefinitions: (
    audienceEntries: ContentfulEntryCollection,
    experienceEntries: ContentfulEntryCollection,
  ) => string
  getPreviewState: () => string
}

class BridgeCoreStateful extends CoreStateful {
  /** Track online-only current-screen state; native consumers explicitly retry after reconnect. */
  async trackCurrentScreen(
    routeKey: string,
    payload: CoreScreenPayload,
  ): Promise<CurrentStateTrackingResult> {
    return await this.emitCurrentScreen(routeKey, () => payload)
  }
}

interface BridgeRuntimeResources {
  disposers: Array<() => void>
  flagSubscriptions: Map<string, { unsubscribe: () => void }>
  instance: BridgeCoreStateful | null
  overrideManager: PreviewOverrideManager | null
}

let runtime: BridgeRuntimeResources | null = null
let audienceDefinitions: AudienceDefinition[] | null = null
let experienceDefinitions: ExperienceDefinition[] | null = null
let audienceNameMap: Record<string, string> = {}
let experienceNameMap: Record<string, string> = {}
let anonymousId: string | undefined = undefined
const acceptedStickyViewKeys = new Set<string>()
const SDK_NOT_INITIALIZED_ERROR = 'SDK not initialized. Call initialize() first.'
const NULL_JSON = JSON.stringify(null)

const clearBridgeModuleState = (): void => {
  audienceDefinitions = null
  experienceDefinitions = null
  audienceNameMap = {}
  experienceNameMap = {}
  acceptedStickyViewKeys.clear()
  anonymousId = undefined
}

const disposeBridgeRuntime = (resources: BridgeRuntimeResources): void => {
  const subscriptions = [...resources.flagSubscriptions.values()]
  resources.flagSubscriptions.clear()
  for (const subscription of subscriptions) subscription.unsubscribe()

  const disposers = resources.disposers.splice(0).reverse()
  resources.instance = null
  resources.overrideManager = null
  for (const dispose of disposers) dispose()
}

const serializeEventEmissionResult = (result: EventEmissionResult): string => {
  if (!result.accepted) return JSON.stringify({ accepted: false })
  if (result.data === undefined) return JSON.stringify({ accepted: true })

  return JSON.stringify({ accepted: true, data: result.data })
}

const collapseCurrentScreenEmissionResult = <TData>(
  result: CurrentStateTrackingResult<TData>,
): EventEmissionResult<TData> => {
  if (!result.accepted) return { accepted: false }
  if (result.data === undefined) return { accepted: true }

  return { accepted: true, data: result.data }
}

type PayloadFieldType = 'boolean' | 'number' | 'object' | 'string'

interface PayloadFieldRule {
  key: string
  required?: boolean
  type: PayloadFieldType
}

const fieldArticle = (type: PayloadFieldType): 'a' | 'an' => (type === 'object' ? 'an' : 'a')

const isFieldType = (value: unknown, type: PayloadFieldType): boolean =>
  type === 'object' ? isRecord(value) : typeof value === type

const validatePayload = (
  method: string,
  payload: unknown,
  fields: readonly PayloadFieldRule[],
): string | null => {
  if (!isRecord(payload)) return `${method} payload must be an object.`

  for (const { key, required, type } of fields) {
    const value = payload[key]
    if (value === undefined && required === true) {
      return `${method} payload must include ${fieldArticle(type)} ${type} "${key}".`
    }
    if (value !== undefined && !isFieldType(value, type)) {
      const prefix =
        required === true ? `${method} payload must include` : `${method} payload "${key}" must be`
      const suffix = required === true ? `"${key}".` : 'when provided.'
      return `${prefix} ${fieldArticle(type)} ${type} ${suffix}`
    }
  }

  return null
}

const identifyPayloadFields: readonly PayloadFieldRule[] = [
  { key: 'userId', required: true, type: 'string' },
  { key: 'traits', type: 'object' },
]
const screenPayloadFields: readonly PayloadFieldRule[] = [
  { key: 'name', required: true, type: 'string' },
  { key: 'properties', type: 'object' },
  { key: 'routeKey', type: 'string' },
]
const trackPayloadFields: readonly PayloadFieldRule[] = [
  { key: 'event', required: true, type: 'string' },
  { key: 'properties', type: 'object' },
]
const trackViewPayloadFields: readonly PayloadFieldRule[] = [
  { key: 'componentId', required: true, type: 'string' },
  { key: 'viewId', required: true, type: 'string' },
  { key: 'experienceId', type: 'string' },
  { key: 'optimizationContextId', type: 'string' },
  { key: 'variantIndex', required: true, type: 'number' },
  { key: 'viewDurationMs', required: true, type: 'number' },
  { key: 'sticky', type: 'boolean' },
  { key: 'stickyTrackingKey', type: 'string' },
]
const trackClickPayloadFields: readonly PayloadFieldRule[] = [
  { key: 'componentId', required: true, type: 'string' },
  { key: 'experienceId', type: 'string' },
  { key: 'optimizationContextId', type: 'string' },
  { key: 'variantIndex', required: true, type: 'number' },
]

const rejectInvalidPayload = (
  validationError: string | null,
  onError: (error: string) => void,
): boolean => {
  if (validationError === null) return false
  onError(validationError)
  return true
}

const getCurrentInstance = (onError: (error: string) => void): BridgeCoreStateful | null => {
  const currentInstance = runtime?.instance
  if (currentInstance) return currentInstance
  onError(SDK_NOT_INITIALIZED_ERROR)
  return null
}

const bridgeErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

const reportBridgeTask = <T>(
  task: Promise<T>,
  onSuccess: (json: string) => void,
  onError: (error: string) => void,
  serialize: (result: T) => string,
): void => {
  task
    .then((result) => {
      onSuccess(serialize(result))
    })
    .catch((err: unknown) => {
      onError(bridgeErrorMessage(err))
    })
}

const runBridgeTask = <T>(
  onSuccess: (json: string) => void,
  onError: (error: string) => void,
  run: (currentInstance: BridgeCoreStateful) => Promise<T>,
  serialize: (result: T) => string,
): void => {
  const currentInstance = getCurrentInstance(onError)
  if (!currentInstance) return

  reportBridgeTask(run(currentInstance), onSuccess, onError, serialize)
}

const runValidatedBridgeTask = <T>(
  method: string,
  payload: unknown,
  fields: readonly PayloadFieldRule[],
  onSuccess: (json: string) => void,
  onError: (error: string) => void,
  run: (currentInstance: BridgeCoreStateful) => Promise<T>,
  serialize: (result: T) => string,
): void => {
  const currentInstance = getCurrentInstance(onError)
  if (!currentInstance) return
  if (rejectInvalidPayload(validatePayload(method, payload, fields), onError)) return

  reportBridgeTask(run(currentInstance), onSuccess, onError, serialize)
}

const readBridgeState = (
  currentInstance: BridgeCoreStateful | null = runtime?.instance ?? null,
): BridgeState => ({
  profile: signals.profile.value ?? null,
  consent: signals.consent.value,
  persistenceConsent: signals.persistenceConsent.value,
  canOptimize: signals.canOptimize.value,
  optimizationPossible: currentInstance?.states.optimizationPossible.current ?? false,
  experienceRequestState: signals.experienceRequestState.value,
  changes: signals.changes.value ?? null,
  locale: signals.locale.value ?? null,
  selectedOptimizations: signals.selectedOptimizations.value ?? null,
})

const createBridgeRuntime = (
  coreConfig: CoreStatefulConfig,
  getPreviewState: () => string,
): BridgeRuntimeResources => {
  let nextRuntime: BridgeRuntimeResources | null = null

  try {
    const nextInstance = new BridgeCoreStateful(coreConfig)
    nextRuntime = {
      disposers: [() => nextInstance.destroy()],
      flagSubscriptions: new Map(),
      instance: nextInstance,
      overrideManager: null,
    }

    // Create the override manager — registers a state interceptor that
    // preserves overrides across API refreshes and correctly appends
    // new experience entries when overriding audiences the user was never in.
    const nextOverrideManager = new PreviewOverrideManager({
      selectedOptimizations: signals.selectedOptimizations,
      profile: signals.profile,
      stateInterceptors: nextInstance.interceptors.state,
      onOverridesChanged: () => {
        nativeGlobal.__nativeOnOverridesChanged?.(getPreviewState())
      },
    })
    nextRuntime.overrideManager = nextOverrideManager
    nextRuntime.disposers.push(() => nextOverrideManager.destroy())

    nextRuntime.disposers.push(
      signalFns.effect(() => {
        const { value: profile } = signals.profile
        const { value: persistenceConsent } = signals.persistenceConsent

        if (persistenceConsent === false) {
          anonymousId = undefined
        } else if (persistenceConsent === true && profile?.id) {
          const { id } = profile
          anonymousId = id
        }

        nativeGlobal.__nativeOnStateChange?.(JSON.stringify(readBridgeState(nextInstance)))
      }),
    )

    nextRuntime.disposers.push(
      signalFns.effect(() => {
        const {
          event: { value },
        } = signals
        if (value) {
          nativeGlobal.__nativeOnEventEmitted?.(JSON.stringify(value))
        }
      }),
    )

    return nextRuntime
  } catch (error) {
    if (nextRuntime) disposeBridgeRuntime(nextRuntime)
    clearBridgeModuleState()
    throw error
  }
}

const bridge: Bridge = {
  initialize(config: BridgeConfig) {
    if (runtime) {
      bridge.destroy()
    }

    clearBridgeModuleState()
    anonymousId = config.defaults?.anonymousId
    const { defaults } = resolveStatefulDefaults(config.defaults)

    const coreConfig: CoreStatefulConfig = {
      clientId: config.clientId,
      environment: config.environment,
      locale: config.locale,
      logLevel: config.logLevel,
      allowedEventTypes: config.allowedEventTypes ?? DEFAULT_NATIVE_ALLOWED_EVENT_TYPES,
      api: {
        experienceBaseUrl: config.api?.experienceBaseUrl,
        insightsBaseUrl: config.api?.insightsBaseUrl,
        enabledFeatures: config.api?.enabledFeatures,
        preflight: config.api?.preflight,
      },
      queuePolicy: {
        ...config.queuePolicy,
        flush: {
          ...config.queuePolicy?.flush,
          onCircuitOpen: (context) => {
            nativeGlobal.__nativeOnQueueEvent?.(JSON.stringify({ type: 'circuitOpen', context }))
          },
          onFlushFailure: (context) => {
            nativeGlobal.__nativeOnQueueEvent?.(JSON.stringify({ type: 'flushFailure', context }))
          },
          onFlushRecovered: (context) => {
            nativeGlobal.__nativeOnQueueEvent?.(JSON.stringify({ type: 'flushRecovered', context }))
          },
        },
        onOfflineDrop: (context) => {
          nativeGlobal.__nativeOnQueueEvent?.(JSON.stringify({ type: 'offlineDrop', context }))
        },
      },
      onEventBlocked: (event) => {
        nativeGlobal.__nativeOnEventBlocked?.(JSON.stringify(event))
      },
      getAnonymousId: () => (signals.persistenceConsent.value === true ? anonymousId : undefined),
      defaults,
    }

    runtime = createBridgeRuntime(coreConfig, () => bridge.getPreviewState())
  },

  identify(payload, onSuccess, onError) {
    runValidatedBridgeTask(
      'identify',
      payload,
      identifyPayloadFields,
      onSuccess,
      onError,
      (currentInstance) => currentInstance.identify(payload),
      serializeEventEmissionResult,
    )
  },

  page(payload, onSuccess, onError) {
    runValidatedBridgeTask(
      'page',
      payload,
      [],
      onSuccess,
      onError,
      (currentInstance) => currentInstance.page(payload),
      serializeEventEmissionResult,
    )
  },

  screen(payload, onSuccess, onError) {
    runValidatedBridgeTask(
      'screen',
      payload,
      screenPayloadFields,
      onSuccess,
      onError,
      (currentInstance) =>
        currentInstance.screen({
          name: payload.name,
          properties: payload.properties ?? {},
        }),
      serializeEventEmissionResult,
    )
  },

  trackCurrentScreen(payload, onSuccess, onError) {
    runValidatedBridgeTask(
      'trackCurrentScreen',
      payload,
      screenPayloadFields,
      onSuccess,
      onError,
      (currentInstance) =>
        currentInstance.trackCurrentScreen(payload.routeKey ?? payload.name, {
          name: payload.name,
          properties: payload.properties ?? {},
        }),
      (result) => serializeEventEmissionResult(collapseCurrentScreenEmissionResult(result)),
    )
  },

  track(payload, onSuccess, onError) {
    runValidatedBridgeTask(
      'track',
      payload,
      trackPayloadFields,
      onSuccess,
      onError,
      (currentInstance) =>
        currentInstance.track({
          ...payload,
          event: payload.event,
          properties: payload.properties ?? {},
        }),
      serializeEventEmissionResult,
    )
  },

  flush(onSuccess, onError) {
    runBridgeTask(
      onSuccess,
      onError,
      (currentInstance) => currentInstance.flush(),
      () => NULL_JSON,
    )
  },

  trackView(payload, onSuccess, onError) {
    const currentInstance = getCurrentInstance(onError)
    if (!currentInstance) return
    if (
      rejectInvalidPayload(validatePayload('trackView', payload, trackViewPayloadFields), onError)
    )
      return

    const { stickyTrackingKey, ...corePayload } = payload
    const stickyKey = stickyTrackingKey ?? payload.viewId
    const shouldSendSticky = shouldSendStickyEntryView(
      payload.sticky,
      acceptedStickyViewKeys.has(stickyKey),
    )

    reportBridgeTask(
      currentInstance.trackView({
        ...corePayload,
        sticky: shouldSendSticky ? true : undefined,
      }),
      onSuccess,
      onError,
      (result) => {
        if (shouldRememberStickyEntryViewResult(shouldSendSticky, result.accepted)) {
          acceptedStickyViewKeys.add(stickyKey)
        }
        return serializeEventEmissionResult(result)
      },
    )
  },

  trackClick(payload, onSuccess, onError) {
    runValidatedBridgeTask(
      'trackClick',
      payload,
      trackClickPayloadFields,
      onSuccess,
      onError,
      (currentInstance) => currentInstance.trackClick(payload),
      () => NULL_JSON,
    )
  },

  consent(accept) {
    const currentInstance = runtime?.instance
    if (!currentInstance) return
    currentInstance.consent(accept)
  },

  setLocale(locale: string): string | null {
    const currentInstance = runtime?.instance
    if (!currentInstance) return null
    return currentInstance.setLocale(locale) ?? null
  },

  reset() {
    const currentInstance = runtime?.instance
    if (!currentInstance) return
    runtime?.overrideManager?.resetAll()
    anonymousId = undefined
    acceptedStickyViewKeys.clear()
    currentInstance.reset()
  },

  setOnline(isOnline: boolean) {
    signals.online.value = isOnline
  },

  getFlag(name: string): string {
    const currentInstance = runtime?.instance
    if (!currentInstance) return NULL_JSON
    return JSON.stringify(currentInstance.getFlag(name) ?? null)
  },

  observeFlag(subscriptionId: string, name: string) {
    const currentRuntime = runtime
    const currentInstance = currentRuntime?.instance
    if (!currentRuntime || !currentInstance) return
    currentRuntime.flagSubscriptions.get(subscriptionId)?.unsubscribe()
    // Subscribing to the flag observable emits a `component` flag-view event
    // through the core event stream; one-off flag reads are not marked tracked
    // until their flag-view event is actually accepted.
    const subscription = currentInstance.states.flag(name).subscribe((value) => {
      nativeGlobal.__nativeOnFlagValueChanged?.(subscriptionId, JSON.stringify(value ?? null))
    })
    currentRuntime.flagSubscriptions.set(subscriptionId, subscription)
  },

  unobserveFlag(subscriptionId: string) {
    runtime?.flagSubscriptions.get(subscriptionId)?.unsubscribe()
    runtime?.flagSubscriptions.delete(subscriptionId)
  },

  resolveOptimizedEntry(baseline, selectedOptimizations): string {
    const currentInstance = runtime?.instance
    if (!currentInstance) return JSON.stringify({ entry: baseline })
    const result = currentInstance.resolveOptimizedEntry(baseline, selectedOptimizations)
    return JSON.stringify(result)
  },

  getMergeTagValue(mergeTagEntry): string | null {
    const currentInstance = runtime?.instance
    if (!currentInstance) return null
    const value = currentInstance.getMergeTagValue(mergeTagEntry)
    return value ?? null
  },

  setPreviewPanelOpen(open: boolean) {
    if (!runtime?.instance) return
    signals.previewPanelOpen.value = open
  },

  overrideAudience(audienceId: string, qualified: boolean, experienceIds: string[]) {
    const currentOverrideManager = runtime?.overrideManager
    if (!currentOverrideManager) return
    if (qualified) {
      currentOverrideManager.activateAudience(audienceId, experienceIds)
    } else {
      currentOverrideManager.deactivateAudience(audienceId, experienceIds)
    }
  },

  overrideVariant(experienceId: string, variantIndex: number) {
    runtime?.overrideManager?.setVariantOverride(experienceId, variantIndex)
  },

  resetAudienceOverride(audienceId: string) {
    runtime?.overrideManager?.resetAudienceOverride(audienceId)
  },

  resetVariantOverride(experienceId: string) {
    runtime?.overrideManager?.resetOptimizationOverride(experienceId)
  },

  resetAllOverrides() {
    runtime?.overrideManager?.resetAll()
  },

  loadDefinitions(audienceEntries, experienceEntries): string {
    try {
      audienceDefinitions = createAudienceDefinitions(audienceEntries)
      experienceDefinitions = createExperienceDefinitions(experienceEntries)
      experienceNameMap = createExperienceNameMap(experienceEntries)
      audienceNameMap = Object.fromEntries(audienceDefinitions.map(({ id, name }) => [id, name]))

      return JSON.stringify({
        audienceCount: audienceDefinitions.length,
        experienceCount: experienceDefinitions.length,
      })
    } catch (err: unknown) {
      audienceDefinitions = null
      experienceDefinitions = null
      audienceNameMap = {}
      experienceNameMap = {}
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },

  getPreviewState(): string {
    const currentOverrideManager = runtime?.overrideManager
    const overrides = currentOverrideManager?.getOverrides() ?? {
      audiences: {},
      selectedOptimizations: {},
    }
    const baselineOptimizations = currentOverrideManager?.getBaselineSelectedOptimizations() ?? null

    const { audienceOverrides, variantOverrides, defaultVariantIndices } = transformOverrides(
      overrides,
      baselineOptimizations,
    )

    const previewModel = computePreviewModel(
      { audienceDefinitions, experienceDefinitions, audienceNameMap, experienceNameMap },
      overrides,
      baselineOptimizations,
    )

    return JSON.stringify({
      ...readBridgeState(),
      previewPanelOpen: signals.previewPanelOpen.value,
      audienceOverrides,
      variantOverrides,
      defaultAudienceQualifications:
        currentOverrideManager?.getBaselineAudienceQualifications() ?? {},
      defaultVariantIndices,
      previewModel,
    })
  },

  getProfile(): string | null {
    const {
      profile: { value },
    } = signals
    return value ? JSON.stringify(value) : null
  },

  getState(): string {
    return JSON.stringify(readBridgeState())
  },

  hasConsent(method: string): boolean {
    return runtime?.instance?.hasConsent(method) ?? false
  },

  destroy() {
    const currentRuntime = runtime
    runtime = null
    try {
      if (currentRuntime) disposeBridgeRuntime(currentRuntime)
    } finally {
      clearBridgeModuleState()
    }
  },
}

nativeGlobal.__bridge = bridge

export default bridge

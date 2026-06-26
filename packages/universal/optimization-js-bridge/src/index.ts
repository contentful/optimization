import type { Traits } from '@contentful/optimization-api-client/api-schemas'
import {
  AcceptedCurrentStateTracker,
  type ConsentInput,
  CoreStateful,
  type CoreStatefulConfig,
  effect,
  type EventEmissionResult,
  type ExperienceRequestState,
  resolveStatefulDefaults,
  shouldRememberStickyEntryViewResult,
  shouldSendStickyEntryView,
  signals,
} from '@contentful/optimization-core'
import {
  type AudienceDefinition,
  type ContentfulEntry,
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
    audienceEntries: ContentfulEntry[],
    experienceEntries: ContentfulEntry[],
  ) => string
  getPreviewState: () => string
}

let instance: CoreStateful | null = null
let disposeEffect: (() => void) | null = null
let disposeEventEffect: (() => void) | null = null
let flagSubscriptions = new Map<string, { unsubscribe: () => void }>()
let overrideManager: PreviewOverrideManager | null = null
let audienceDefinitions: AudienceDefinition[] | null = null
let experienceDefinitions: ExperienceDefinition[] | null = null
let audienceNameMap: Record<string, string> = {}
let experienceNameMap: Record<string, string> = {}
let anonymousId: string | undefined = undefined
const currentScreenTracker = new AcceptedCurrentStateTracker<string>()
const acceptedStickyViewKeys = new Set<string>()

const serializeEventEmissionResult = (result: EventEmissionResult): string => {
  if (!result.accepted) return JSON.stringify({ accepted: false })
  if (result.data === undefined) return JSON.stringify({ accepted: true })

  return JSON.stringify({ accepted: true, data: result.data })
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

type PayloadFieldType = 'boolean' | 'number' | 'object' | 'string'

interface PayloadFieldRule {
  key: string
  required?: boolean
  type: PayloadFieldType
}

const fieldArticle = (type: PayloadFieldType): 'a' | 'an' => (type === 'object' ? 'an' : 'a')

const isFieldType = (value: unknown, type: PayloadFieldType): boolean =>
  type === 'object' ? isObjectRecord(value) : typeof value === type

const validatePayload = (
  method: string,
  payload: unknown,
  fields: readonly PayloadFieldRule[],
): string | null => {
  if (!isObjectRecord(payload)) return `${method} payload must be an object.`

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

const bridge: Bridge = {
  initialize(config: BridgeConfig) {
    if (instance) {
      bridge.destroy()
    }

    audienceDefinitions = null
    experienceDefinitions = null
    audienceNameMap = {}
    experienceNameMap = {}
    anonymousId = config.defaults?.anonymousId
    currentScreenTracker.reset()
    acceptedStickyViewKeys.clear()
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

    instance = new CoreStateful(coreConfig)

    // Create the override manager — registers a state interceptor that
    // preserves overrides across API refreshes and correctly appends
    // new experience entries when overriding audiences the user was never in.
    overrideManager = new PreviewOverrideManager({
      selectedOptimizations: signals.selectedOptimizations,
      profile: signals.profile,
      stateInterceptors: instance.interceptors.state,
      onOverridesChanged: () => {
        nativeGlobal.__nativeOnOverridesChanged?.(bridge.getPreviewState())
      },
    })

    disposeEffect = effect(() => {
      const profile = signals.profile.value
      const persistenceConsent = signals.persistenceConsent.value

      if (persistenceConsent === false) {
        anonymousId = undefined
      } else if (persistenceConsent === true && profile?.id) {
        anonymousId = profile.id
      }

      const state: BridgeState = {
        profile: profile ?? null,
        consent: signals.consent.value,
        persistenceConsent,
        canOptimize: signals.canOptimize.value,
        optimizationPossible: instance?.states.optimizationPossible.current ?? false,
        experienceRequestState: signals.experienceRequestState.value,
        changes: signals.changes.value ?? null,
        locale: signals.locale.value ?? null,
        selectedOptimizations: signals.selectedOptimizations.value ?? null,
      }

      nativeGlobal.__nativeOnStateChange?.(JSON.stringify(state))
    })

    disposeEventEffect = effect(() => {
      const {
        event: { value },
      } = signals
      if (value) {
        nativeGlobal.__nativeOnEventEmitted?.(JSON.stringify(value))
      }
    })
  },

  identify(payload, onSuccess, onError) {
    if (!instance) {
      onError('SDK not initialized. Call initialize() first.')
      return
    }
    if (rejectInvalidPayload(validatePayload('identify', payload, identifyPayloadFields), onError))
      return

    instance
      .identify(payload)
      .then((result) => {
        onSuccess(serializeEventEmissionResult(result))
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : String(err))
      })
  },

  page(payload, onSuccess, onError) {
    if (!instance) {
      onError('SDK not initialized. Call initialize() first.')
      return
    }
    if (rejectInvalidPayload(validatePayload('page', payload, []), onError)) return

    instance
      .page(payload)
      .then((result) => {
        onSuccess(serializeEventEmissionResult(result))
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : String(err))
      })
  },

  screen(payload, onSuccess, onError) {
    if (!instance) {
      onError('SDK not initialized. Call initialize() first.')
      return
    }
    if (rejectInvalidPayload(validatePayload('screen', payload, screenPayloadFields), onError))
      return

    instance
      .screen({
        name: payload.name,
        properties: payload.properties ?? {},
      })
      .then((result) => {
        onSuccess(serializeEventEmissionResult(result))
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : String(err))
      })
  },

  trackCurrentScreen(payload, onSuccess, onError) {
    if (!instance) {
      onError('SDK not initialized. Call initialize() first.')
      return
    }
    if (
      rejectInvalidPayload(
        validatePayload('trackCurrentScreen', payload, screenPayloadFields),
        onError,
      )
    )
      return

    const currentInstance = instance

    currentScreenTracker
      .emitIfNeeded({
        key: payload.routeKey ?? payload.name,
        isAllowed: currentInstance.hasConsent('screen'),
        emit: async () =>
          await currentInstance.screen({
            name: payload.name,
            properties: payload.properties ?? {},
          }),
      })
      .then((result) => {
        onSuccess(serializeEventEmissionResult(result))
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : String(err))
      })
  },

  track(payload, onSuccess, onError) {
    if (!instance) {
      onError('SDK not initialized. Call initialize() first.')
      return
    }
    if (rejectInvalidPayload(validatePayload('track', payload, trackPayloadFields), onError)) return

    instance
      .track({
        ...payload,
        event: payload.event,
        properties: payload.properties ?? {},
      })
      .then((result) => {
        onSuccess(serializeEventEmissionResult(result))
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : String(err))
      })
  },

  flush(onSuccess, onError) {
    if (!instance) {
      onError('SDK not initialized. Call initialize() first.')
      return
    }

    instance
      .flush()
      .then(() => {
        onSuccess(JSON.stringify(null))
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : String(err))
      })
  },

  trackView(payload, onSuccess, onError) {
    if (!instance) {
      onError('SDK not initialized. Call initialize() first.')
      return
    }
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

    instance
      .trackView({
        ...corePayload,
        sticky: shouldSendSticky ? true : undefined,
      })
      .then((result) => {
        if (shouldRememberStickyEntryViewResult(shouldSendSticky, result.accepted)) {
          acceptedStickyViewKeys.add(stickyKey)
        }
        onSuccess(serializeEventEmissionResult(result))
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : String(err))
      })
  },

  trackClick(payload, onSuccess, onError) {
    if (!instance) {
      onError('SDK not initialized. Call initialize() first.')
      return
    }
    if (
      rejectInvalidPayload(validatePayload('trackClick', payload, trackClickPayloadFields), onError)
    )
      return

    instance
      .trackClick(payload)
      .then(() => {
        onSuccess(JSON.stringify(null))
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : String(err))
      })
  },

  consent(accept) {
    if (!instance) return
    instance.consent(accept)
  },

  setLocale(locale: string): string | null {
    if (!instance) return null
    return instance.setLocale(locale) ?? null
  },

  reset() {
    if (!instance) return
    overrideManager?.resetAll()
    currentScreenTracker.reset()
    acceptedStickyViewKeys.clear()
    instance.reset()
  },

  setOnline(isOnline: boolean) {
    signals.online.value = isOnline
  },

  getFlag(name: string): string {
    if (!instance) return JSON.stringify(null)
    return JSON.stringify(instance.getFlag(name) ?? null)
  },

  observeFlag(subscriptionId: string, name: string) {
    if (!instance) return
    flagSubscriptions.get(subscriptionId)?.unsubscribe()
    // Subscribing to the flag observable emits a `component` flag-view event
    // through the core event stream; one-off flag reads are not marked tracked
    // until their flag-view event is actually accepted.
    const subscription = instance.states.flag(name).subscribe((value) => {
      nativeGlobal.__nativeOnFlagValueChanged?.(subscriptionId, JSON.stringify(value ?? null))
    })
    flagSubscriptions.set(subscriptionId, subscription)
  },

  unobserveFlag(subscriptionId: string) {
    flagSubscriptions.get(subscriptionId)?.unsubscribe()
    flagSubscriptions.delete(subscriptionId)
  },

  resolveOptimizedEntry(baseline, selectedOptimizations): string {
    if (!instance) return JSON.stringify({ entry: baseline })
    const result = instance.resolveOptimizedEntry(baseline, selectedOptimizations)
    return JSON.stringify(result)
  },

  getMergeTagValue(mergeTagEntry): string | null {
    if (!instance) return null
    const value = instance.getMergeTagValue(mergeTagEntry)
    return value ?? null
  },

  setPreviewPanelOpen(open: boolean) {
    if (!instance) return
    signals.previewPanelOpen.value = open
  },

  overrideAudience(audienceId: string, qualified: boolean, experienceIds: string[]) {
    if (!overrideManager) return
    if (qualified) {
      overrideManager.activateAudience(audienceId, experienceIds)
    } else {
      overrideManager.deactivateAudience(audienceId, experienceIds)
    }
  },

  overrideVariant(experienceId: string, variantIndex: number) {
    overrideManager?.setVariantOverride(experienceId, variantIndex)
  },

  resetAudienceOverride(audienceId: string) {
    overrideManager?.resetAudienceOverride(audienceId)
  },

  resetVariantOverride(experienceId: string) {
    overrideManager?.resetOptimizationOverride(experienceId)
  },

  resetAllOverrides() {
    overrideManager?.resetAll()
  },

  loadDefinitions(audienceEntries, experienceEntries): string {
    try {
      audienceDefinitions = createAudienceDefinitions(audienceEntries)
      experienceDefinitions = createExperienceDefinitions(experienceEntries)
      experienceNameMap = createExperienceNameMap(experienceEntries)
      audienceNameMap = {}
      for (const { id, name } of audienceDefinitions) {
        audienceNameMap[id] = name
      }

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
    const overrides = overrideManager?.getOverrides() ?? {
      audiences: {},
      selectedOptimizations: {},
    }
    const baselineOptimizations = overrideManager?.getBaselineSelectedOptimizations() ?? null

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
      profile: signals.profile.value ?? null,
      consent: signals.consent.value,
      persistenceConsent: signals.persistenceConsent.value,
      canOptimize: signals.canOptimize.value,
      optimizationPossible: instance?.states.optimizationPossible.current ?? false,
      experienceRequestState: signals.experienceRequestState.value,
      changes: signals.changes.value ?? null,
      locale: signals.locale.value ?? null,
      selectedOptimizations: signals.selectedOptimizations.value ?? null,
      previewPanelOpen: signals.previewPanelOpen.value,
      audienceOverrides,
      variantOverrides,
      defaultAudienceQualifications: overrideManager?.getBaselineAudienceQualifications() ?? {},
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
    const state: BridgeState = {
      profile: signals.profile.value ?? null,
      consent: signals.consent.value,
      persistenceConsent: signals.persistenceConsent.value,
      canOptimize: signals.canOptimize.value,
      optimizationPossible: instance?.states.optimizationPossible.current ?? false,
      experienceRequestState: signals.experienceRequestState.value,
      changes: signals.changes.value ?? null,
      locale: signals.locale.value ?? null,
      selectedOptimizations: signals.selectedOptimizations.value ?? null,
    }
    return JSON.stringify(state)
  },

  hasConsent(method: string): boolean {
    return instance?.hasConsent(method) ?? false
  },

  destroy() {
    overrideManager?.destroy()
    overrideManager = null
    audienceDefinitions = null
    experienceDefinitions = null
    audienceNameMap = {}
    experienceNameMap = {}
    for (const subscription of flagSubscriptions.values()) {
      subscription.unsubscribe()
    }
    flagSubscriptions = new Map()
    if (disposeEventEffect) {
      disposeEventEffect()
      disposeEventEffect = null
    }
    if (disposeEffect) {
      disposeEffect()
      disposeEffect = null
    }
    if (instance) {
      instance.destroy()
      instance = null
    }
    currentScreenTracker.reset()
    acceptedStickyViewKeys.clear()
    anonymousId = undefined
  },
}

nativeGlobal.__bridge = bridge

export default bridge

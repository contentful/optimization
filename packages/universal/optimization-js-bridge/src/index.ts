import type { Traits } from '@contentful/optimization-api-client/api-schemas'
import {
  CoreStateful,
  type CoreStatefulConfig,
  effect,
  signals,
} from '@contentful/optimization-core'
import {
  type AudienceDefinition,
  type ContentfulEntry,
  type ExperienceDefinition,
  PreviewOverrideManager,
  createAudienceDefinitions,
  createExperienceDefinitions,
  createExperienceNameMap,
} from '@contentful/optimization-core/preview-support'
import { computePreviewModel, transformOverrides } from './previewStateHelpers'

type ResolveOptimizedEntryArgs = Parameters<CoreStateful['resolveOptimizedEntry']>
type ResolveOptimizedEntryEntry = ResolveOptimizedEntryArgs[0]
type ResolveOptimizedEntrySelections = ResolveOptimizedEntryArgs[1]
type GetMergeTagValueEntry = Parameters<CoreStateful['getMergeTagValue']>[0]
type ScreenProperties = Parameters<CoreStateful['screen']>[0]['properties']

type ProfileValue = typeof signals.profile.value
type ChangesValue = typeof signals.changes.value
type SelectedOptimizationsValue = typeof signals.selectedOptimizations.value

// Native runtimes (iOS JavaScriptCore, Android QuickJS) install these callbacks
// on the JS engine's globalThis before the bridge is loaded. The bridge calls
// them to push state/event updates back into the native layer. `window` is NOT
// defined in QuickJS or JSC — only `globalThis` is universal across both
// engines plus any browser-style WebView consumer.
interface NativeGlobal {
  __nativeOnStateChange?: (json: string) => void
  __nativeOnEventEmitted?: (json: string) => void
  __nativeOnOverridesChanged?: (json: string) => void
  __bridge?: Bridge
}
const nativeGlobal = globalThis as typeof globalThis & NativeGlobal

interface BridgeConfig {
  clientId: string
  environment: string
  experienceBaseUrl?: string
  insightsBaseUrl?: string
  api?: {
    locale?: string
  }
  contentfulLocales?: CoreStatefulConfig['contentfulLocales']
  locale?: string
  defaults?: {
    consent?: boolean
    profile?: ProfileValue
    changes?: ChangesValue
    optimizations?: SelectedOptimizationsValue
  }
}

interface BridgeState {
  profile: ProfileValue | null
  consent: boolean | undefined
  canPersonalize: boolean
  changes: ChangesValue | null
  locale: string | null
  selectedPersonalizations: SelectedOptimizationsValue | null
}

interface TrackViewPayload {
  componentId: string
  viewId: string
  experienceId?: string
  variantIndex: number
  viewDurationMs: number
  sticky?: boolean
}

interface TrackClickPayload {
  componentId: string
  experienceId?: string
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
  destroy: () => void

  // Async with callbacks
  screen: (
    payload: { name: string; properties?: ScreenProperties },
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
  consent: (accept: boolean) => void
  setLocale: (locale: string) => string | null
  reset: () => void
  // Native code passes JSON-shaped objects; the bridge trusts the shape and
  // forwards them straight to core. TypeScript types here document the
  // expected payload, but no runtime narrowing is performed.
  personalizeEntry: (
    baseline: ResolveOptimizedEntryEntry,
    personalizations?: ResolveOptimizedEntrySelections,
  ) => string
  getMergeTagValue: (mergeTagEntry: GetMergeTagValueEntry) => string | null
  flag: (name: string) => void
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
let flagSubscriptions: Array<{ unsubscribe: () => void }> = []
let overrideManager: PreviewOverrideManager | null = null
let audienceDefinitions: AudienceDefinition[] | null = null
let experienceDefinitions: ExperienceDefinition[] | null = null
let audienceNameMap: Record<string, string> = {}
let experienceNameMap: Record<string, string> = {}

const bridge: Bridge = {
  initialize(config: BridgeConfig) {
    if (instance) {
      bridge.destroy()
    }

    audienceDefinitions = null
    experienceDefinitions = null
    audienceNameMap = {}
    experienceNameMap = {}

    const coreConfig: CoreStatefulConfig = {
      clientId: config.clientId,
      environment: config.environment,
      contentfulLocales: config.contentfulLocales,
      locale: config.locale,
      api: {
        experienceBaseUrl: config.experienceBaseUrl,
        insightsBaseUrl: config.insightsBaseUrl,
        locale: config.api?.locale,
      },
    }

    instance = new CoreStateful(coreConfig)

    // Apply stored defaults before any other operations
    const { defaults } = config
    if (defaults) {
      const { consent, profile, changes, optimizations } = defaults
      if (consent !== undefined) {
        instance.consent(consent)
      }
      if (profile !== undefined) {
        signals.profile.value = profile
      }
      if (changes !== undefined) {
        signals.changes.value = changes
      }
      if (optimizations !== undefined) {
        signals.selectedOptimizations.value = optimizations
      }
    }
    instance.consent(true)

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
      const state: BridgeState = {
        profile: signals.profile.value ?? null,
        consent: signals.consent.value,
        canPersonalize: signals.canOptimize.value,
        changes: signals.changes.value ?? null,
        locale: signals.locale.value ?? null,
        selectedPersonalizations: signals.selectedOptimizations.value ?? null,
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

    instance
      .identify(payload)
      .then((data) => {
        onSuccess(JSON.stringify(data ?? null))
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

    instance
      .page(payload)
      .then((data) => {
        onSuccess(JSON.stringify(data ?? null))
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

    instance
      .screen({
        name: payload.name,
        properties: payload.properties ?? {},
      })
      .then((data) => {
        onSuccess(JSON.stringify(data ?? null))
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

    instance
      .trackView(payload)
      .then((data) => {
        onSuccess(JSON.stringify(data ?? null))
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

    instance
      .trackClick(payload)
      .then(() => {
        onSuccess(JSON.stringify(null))
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : String(err))
      })
  },

  consent(accept: boolean) {
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
    instance.reset()
  },

  setOnline(isOnline: boolean) {
    signals.online.value = isOnline
  },

  flag(name: string) {
    if (!instance) return
    // Subscribing to the flag observable emits a `component` flag-view event
    // through the core event stream (and again on each distinct value change).
    flagSubscriptions.push(instance.states.flag(name).subscribe(() => undefined))
  },

  personalizeEntry(baseline, personalizations): string {
    if (!instance) return JSON.stringify({ entry: baseline })
    const result = instance.resolveOptimizedEntry(baseline, personalizations)
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
      canPersonalize: signals.canOptimize.value,
      changes: signals.changes.value ?? null,
      locale: signals.locale.value ?? null,
      selectedPersonalizations: signals.selectedOptimizations.value ?? null,
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
      canPersonalize: signals.canOptimize.value,
      changes: signals.changes.value ?? null,
      locale: signals.locale.value ?? null,
      selectedPersonalizations: signals.selectedOptimizations.value ?? null,
    }
    return JSON.stringify(state)
  },

  destroy() {
    overrideManager?.destroy()
    overrideManager = null
    audienceDefinitions = null
    experienceDefinitions = null
    audienceNameMap = {}
    experienceNameMap = {}
    for (const subscription of flagSubscriptions) {
      subscription.unsubscribe()
    }
    flagSubscriptions = []
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
  },
}

nativeGlobal.__bridge = bridge

export default bridge

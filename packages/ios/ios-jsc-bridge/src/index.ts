import type { Traits } from '@contentful/optimization-api-client/api-schemas'
import {
  CoreStateful,
  type CoreStatefulConfig,
  effect,
  signals,
} from '@contentful/optimization-core'
import { PreviewOverrideManager } from '@contentful/optimization-core/preview'

type ResolveOptimizedEntryParams = Parameters<CoreStateful['resolveOptimizedEntry']>

interface BridgeConfig {
  clientId: string
  environment: string
  experienceBaseUrl?: string
  insightsBaseUrl?: string
  defaults?: {
    consent?: boolean
    profile?: unknown
    changes?: unknown
    optimizations?: unknown
  }
}

interface BridgeState {
  profile: unknown
  consent: boolean | undefined
  canPersonalize: boolean
  changes: unknown
  selectedPersonalizations: unknown
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
  initialize(config: BridgeConfig): void
  identify(
    payload: { userId: string; traits?: Traits },
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ): void
  page(
    payload: Record<string, unknown>,
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ): void
  getProfile(): string | null
  getState(): string
  destroy(): void

  // Async with callbacks
  screen(
    payload: { name: string; properties?: Record<string, unknown> },
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ): void
  flush(onSuccess: (json: string) => void, onError: (error: string) => void): void
  trackView(
    payload: TrackViewPayload,
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ): void
  trackClick(
    payload: TrackClickPayload,
    onSuccess: (json: string) => void,
    onError: (error: string) => void,
  ): void

  // Synchronous
  consent(accept: boolean): void
  reset(): void
  personalizeEntry(
    baseline: Record<string, unknown>,
    personalizations?: Array<Record<string, unknown>>,
  ): string
  setOnline(isOnline: boolean): void

  // Preview panel
  setPreviewPanelOpen(open: boolean): void
  overrideAudience(audienceId: string, qualified: boolean): void
  overrideVariant(experienceId: string, variantIndex: number): void
  resetAudienceOverride(audienceId: string): void
  resetVariantOverride(experienceId: string): void
  resetAllOverrides(): void
  getPreviewState(): string
}

let instance: CoreStateful | null = null
let disposeEffect: (() => void) | null = null
let disposeEventEffect: (() => void) | null = null
let overrideManager: PreviewOverrideManager | null = null

const bridge: Bridge = {
  initialize(config: BridgeConfig) {
    if (instance) {
      bridge.destroy()
    }

    const coreConfig: CoreStatefulConfig = {
      clientId: config.clientId,
      environment: config.environment,
      api: {
        experienceBaseUrl: config.experienceBaseUrl,
        insightsBaseUrl: config.insightsBaseUrl,
      },
    }

    instance = new CoreStateful(coreConfig)

    // Apply stored defaults before any other operations
    if (config.defaults) {
      if (config.defaults.consent !== undefined) {
        instance.consent(config.defaults.consent)
      }
      if (config.defaults.profile !== undefined) {
        signals.profile.value = config.defaults.profile as typeof signals.profile.value
      }
      if (config.defaults.changes !== undefined) {
        signals.changes.value = config.defaults.changes as typeof signals.changes.value
      }
      if (config.defaults.optimizations !== undefined) {
        signals.selectedOptimizations.value = config.defaults
          .optimizations as typeof signals.selectedOptimizations.value
      }
    }
    instance.consent(true)

    // Create the override manager — registers a state interceptor that
    // preserves overrides across API refreshes and correctly appends
    // new experience entries when overriding audiences the user was never in.
    overrideManager = new PreviewOverrideManager({
      selectedOptimizations: signals.selectedOptimizations,
      stateInterceptors: instance.interceptors.state,
    })

    const g = globalThis as Record<string, unknown>

    disposeEffect = effect(() => {
      const state: BridgeState = {
        profile: signals.profile.value ?? null,
        consent: signals.consent.value,
        canPersonalize: signals.canOptimize.value,
        changes: signals.changes.value ?? null,
        selectedPersonalizations: signals.selectedOptimizations.value ?? null,
      }

      if (typeof g.__nativeOnStateChange === 'function') {
        ;(g.__nativeOnStateChange as (json: string) => void)(JSON.stringify(state))
      }
    })

    disposeEventEffect = effect(() => {
      const evt = signals.event.value
      if (evt && typeof g.__nativeOnEventEmitted === 'function') {
        ;(g.__nativeOnEventEmitted as (json: string) => void)(JSON.stringify(evt))
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
        properties: (payload.properties ?? {}) as Record<string, never>,
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

  reset() {
    if (!instance) return
    overrideManager?.resetAll()
    instance.reset()
  },

  setOnline(isOnline: boolean) {
    signals.online.value = isOnline
  },

  personalizeEntry(
    baseline: Record<string, unknown>,
    personalizations?: Array<Record<string, unknown>>,
  ): string {
    if (!instance) return JSON.stringify({ entry: baseline })
    const result = instance.resolveOptimizedEntry(
      baseline as unknown as ResolveOptimizedEntryParams[0],
      personalizations as unknown as ResolveOptimizedEntryParams[1],
    )
    return JSON.stringify(result)
  },

  setPreviewPanelOpen(open: boolean) {
    if (!instance) return
    signals.previewPanelOpen.value = open
  },

  overrideAudience(audienceId: string, qualified: boolean) {
    if (!overrideManager) return
    // The Swift side calls overrideAudience for the audience toggle, then
    // separately calls overrideVariant for each experience. So here we just
    // record the audience metadata; the variant overrides arrive individually.
    const currentOverrides = overrideManager.getOverrides()
    const existingAudience = currentOverrides.audiences[audienceId]
    const experienceIds = existingAudience?.experienceIds ?? []

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

  getPreviewState(): string {
    const overrides = overrideManager?.getOverrides() ?? {
      audiences: {},
      selectedOptimizations: {},
    }
    const baselineOptimizations = overrideManager?.getBaselineSelectedOptimizations()

    // Transform audience overrides to the shape Swift expects: Record<string, boolean>
    const audienceOverrides: Record<string, boolean> = {}
    for (const [id, aud] of Object.entries(overrides.audiences)) {
      audienceOverrides[id] = aud.isActive
    }

    // Transform variant overrides to the shape Swift expects: Record<string, number>
    const variantOverrides: Record<string, number> = {}
    for (const [id, opt] of Object.entries(overrides.selectedOptimizations)) {
      variantOverrides[id] = opt.variantIndex
    }

    // Derive default variant indices from the baseline
    const defaultVariantIndices: Record<string, number> = {}
    if (baselineOptimizations) {
      for (const sel of baselineOptimizations) {
        if (variantOverrides[sel.experienceId] !== undefined) {
          defaultVariantIndices[sel.experienceId] = sel.variantIndex
        }
      }
    }

    return JSON.stringify({
      profile: signals.profile.value ?? null,
      consent: signals.consent.value,
      canPersonalize: signals.canOptimize.value,
      changes: signals.changes.value ?? null,
      selectedPersonalizations: signals.selectedOptimizations.value ?? null,
      previewPanelOpen: signals.previewPanelOpen.value,
      audienceOverrides,
      variantOverrides,
      defaultAudienceQualifications: {},
      defaultVariantIndices,
    })
  },

  getProfile(): string | null {
    const p = signals.profile.value
    return p ? JSON.stringify(p) : null
  },

  getState(): string {
    const state: BridgeState = {
      profile: signals.profile.value ?? null,
      consent: signals.consent.value,
      canPersonalize: signals.canOptimize.value,
      changes: signals.changes.value ?? null,
      selectedPersonalizations: signals.selectedOptimizations.value ?? null,
    }
    return JSON.stringify(state)
  },

  destroy() {
    overrideManager?.destroy()
    overrideManager = null
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

;(globalThis as Record<string, unknown>).__bridge = bridge

export default bridge

import type { Traits } from '@contentful/optimization-api-client/api-schemas'
import {
  CoreStateful,
  type CoreStatefulConfig,
  effect,
  signals,
} from '@contentful/optimization-core'

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
  personalizeEntry(baselineJSON: string, personalizationsJSON?: string): string
  setOnline(isOnline: boolean): void

  // Preview panel
  setPreviewPanelOpen(open: boolean): void
  overrideAudience(audienceId: string, qualified: boolean): void
  overrideVariant(experienceId: string, variantIndex: number): void
  getPreviewState(): string
}

let instance: CoreStateful | null = null
let disposeEffect: (() => void) | null = null
let disposeEventEffect: (() => void) | null = null

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
    instance.reset()
  },

  setOnline(isOnline: boolean) {
    signals.online.value = isOnline
  },

  personalizeEntry(baselineJSON: string, personalizationsJSON?: string): string {
    if (!instance) return JSON.stringify({ entry: JSON.parse(baselineJSON) })
    const baseline = JSON.parse(baselineJSON)
    const personalizations = personalizationsJSON ? JSON.parse(personalizationsJSON) : undefined
    const result = instance.resolveOptimizedEntry(baseline, personalizations)
    return JSON.stringify(result)
  },

  setPreviewPanelOpen(open: boolean) {
    if (!instance) return
    signals.previewPanelOpen.value = open
  },

  overrideAudience(audienceId: string, qualified: boolean) {
    if (!instance) return
    // Override audience qualification via changes signal
    const currentChanges = (signals.changes.value ?? []) as Array<Record<string, unknown>>
    const updatedChanges = currentChanges.map((change) => {
      if (change.audienceId === audienceId) {
        return { ...change, qualified }
      }
      return change
    })
    signals.changes.value = updatedChanges as typeof signals.changes.value
  },

  overrideVariant(experienceId: string, variantIndex: number) {
    if (!instance) return
    const currentPersonalizations = (signals.selectedOptimizations.value ?? []) as Array<
      Record<string, unknown>
    >
    const updatedPersonalizations = currentPersonalizations.map((p) => {
      if (p.experienceId === experienceId) {
        return { ...p, variantIndex }
      }
      return p
    })
    signals.selectedOptimizations.value =
      updatedPersonalizations as typeof signals.selectedOptimizations.value
  },

  getPreviewState(): string {
    return JSON.stringify({
      profile: signals.profile.value ?? null,
      consent: signals.consent.value,
      canPersonalize: signals.canOptimize.value,
      changes: signals.changes.value ?? null,
      selectedPersonalizations: signals.selectedOptimizations.value ?? null,
      previewPanelOpen: signals.previewPanelOpen.value,
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

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
      personalization: config.experienceBaseUrl ? { baseUrl: config.experienceBaseUrl } : undefined,
      analytics: config.insightsBaseUrl ? { baseUrl: config.insightsBaseUrl } : undefined,
    }

    instance = new CoreStateful(coreConfig)
    instance.consent(true)

    const g = globalThis as Record<string, unknown>

    disposeEffect = effect(() => {
      const state: BridgeState = {
        profile: signals.profile.value ?? null,
        consent: signals.consent.value,
        canPersonalize: signals.canPersonalize.value,
        changes: signals.changes.value ?? null,
        selectedPersonalizations: signals.selectedPersonalizations.value ?? null,
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
      .screen(payload)
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
    const result = instance.personalizeEntry(baseline, personalizations)
    return JSON.stringify(result)
  },

  getProfile(): string | null {
    const p = signals.profile.value
    return p ? JSON.stringify(p) : null
  },

  getState(): string {
    const state: BridgeState = {
      profile: signals.profile.value ?? null,
      consent: signals.consent.value,
      canPersonalize: signals.canPersonalize.value,
      changes: signals.changes.value ?? null,
      selectedPersonalizations: signals.selectedPersonalizations.value ?? null,
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

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
}

let instance: CoreStateful | null = null
let disposeEffect: (() => void) | null = null

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

    disposeEffect = effect(() => {
      const state: BridgeState = {
        profile: signals.profile.value ?? null,
        consent: signals.consent.value,
        canPersonalize: signals.canPersonalize.value,
        changes: signals.changes.value ?? null,
      }

      const g = globalThis as Record<string, unknown>
      if (typeof g.__nativeOnStateChange === 'function') {
        ;(g.__nativeOnStateChange as (json: string) => void)(JSON.stringify(state))
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
    }
    return JSON.stringify(state)
  },

  destroy() {
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

import type { Entry } from 'contentful'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import type { OptimizationContextValue, OptimizationSdk } from '../context/OptimizationContext'
import type { UseOptimizationResult } from '../hooks/useOptimization'

export function createObservable<T>(current: T): {
  current: T
  subscribe: (next: (value: T) => void) => { unsubscribe: () => void }
  subscribeOnce: (next: (value: NonNullable<T>) => void) => { unsubscribe: () => void }
} {
  return {
    current,
    subscribe: () => ({ unsubscribe: () => undefined }),
    subscribeOnce: () => ({ unsubscribe: () => undefined }),
  }
}

export function createOptimizationSdk(overrides: Partial<OptimizationSdk> = {}): OptimizationSdk {
  return {
    consent: () => undefined,
    destroy: () => undefined,
    getFlag: () => undefined,
    getMergeTagValue: () => undefined,
    identify: async () => {
      await Promise.resolve()
      return undefined
    },
    page: async () => {
      await Promise.resolve()
      return undefined
    },
    personalizeEntry: (entry: Entry) => ({ entry }),
    reset: () => undefined,
    states: {
      blockedEventStream: createObservable(undefined),
      canPersonalize: createObservable(false),
      consent: createObservable(undefined),
      eventStream: createObservable(undefined),
      flag: () => createObservable(undefined),
      previewPanelAttached: createObservable(false),
      previewPanelOpen: createObservable(false),
      profile: createObservable(undefined),
      selectedPersonalizations: createObservable(undefined),
    },
    track: async () => {
      await Promise.resolve()
      return undefined
    },
    trackClick: async () => {
      await Promise.resolve()
      return undefined
    },
    trackView: async () => {
      await Promise.resolve()
      return undefined
    },
    tracking: {
      clearElement: () => undefined,
      disable: () => undefined,
      disableElement: () => undefined,
      enable: () => undefined,
      enableElement: () => undefined,
    },
    ...overrides,
  }
}

export function captureRenderError(element: ReactElement): unknown {
  try {
    renderToString(element)
    return null
  } catch (error: unknown) {
    return error
  }
}

export function requireOptimizationContext(
  value: OptimizationContextValue | null,
): OptimizationContextValue {
  if (value === null) {
    throw new Error('Expected optimization context to be captured')
  }

  return value
}

export function requireOptimizationResult(
  value: UseOptimizationResult | undefined,
): UseOptimizationResult {
  if (value === undefined) {
    throw new Error('Expected optimization instance to be captured')
  }

  return value
}

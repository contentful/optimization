import type { Entry } from 'contentful'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import type { OptimizationContextValue } from '../context/OptimizationContext'
import type { UseOptimizationResult } from '../hooks/useOptimization'
import type { OptimizationSdk } from '../types'

export function createTestEntry(id: string): Entry {
  return {
    fields: { title: id },
    metadata: { tags: [] },
    sys: {
      contentType: { sys: { id: 'test-content-type', linkType: 'ContentType', type: 'Link' } },
      createdAt: '2024-01-01T00:00:00.000Z',
      environment: { sys: { id: 'main', linkType: 'Environment', type: 'Link' } },
      id,
      publishedVersion: 1,
      revision: 1,
      space: { sys: { id: 'space-id', linkType: 'Space', type: 'Link' } },
      type: 'Entry',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  }
}

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
    trackView: async () => {
      await Promise.resolve()
      return undefined
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
    throw new Error('Expected optimization hook result to be captured')
  }

  return value
}

import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import type { ReactElement, ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { LiveUpdatesContextValue } from '../context/LiveUpdatesContext'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import type { OptimizationContextValue, OptimizationSdk } from '../context/OptimizationContext'
import { OptimizationContext } from '../context/OptimizationContext'
import type { UseOptimizationResult } from '../hooks/useOptimization'

export type TestEntry = Entry
export type SelectedOptimizationState = SelectedOptimizationArray | undefined
export type ResolveOptimizedEntry = (
  entry: TestEntry,
  selectedOptimizations: SelectedOptimizationState,
) => ResolvedData<EntrySkeletonType>

interface Subscription {
  unsubscribe: () => void
}

interface ObservableLike<T> {
  current: T
  subscribe: (next: (value: T) => void) => Subscription
  subscribeOnce: (next: (value: NonNullable<T>) => void) => Subscription
}
type RuntimeSubscriber<T> = (value: T) => void

export interface RuntimeOptimization extends OptimizationSdk {
  resolveOptimizedEntry: ResolveOptimizedEntry
  states: OptimizationSdk['states'] & {
    canOptimize: ObservableLike<boolean>
    selectedOptimizations: ObservableLike<SelectedOptimizationState>
  }
}

export type OptimizationSdkOverrides = Omit<Partial<OptimizationSdk>, 'states' | 'tracking'> & {
  states?: Partial<OptimizationSdk['states']>
  tracking?: Partial<OptimizationSdk['tracking']>
}

export function createObservable<T>(current: T): ObservableLike<T> {
  return {
    current,
    subscribe: () => ({ unsubscribe: () => undefined }),
    subscribeOnce: () => ({ unsubscribe: () => undefined }),
  }
}

export function createTestEntry(id: string): TestEntry {
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

export function createOptimizableTestEntry(id: string): TestEntry {
  const entry = createTestEntry(id)
  entry.fields = {
    ...entry.fields,
    nt_experiences: [{ sys: { id: 'exp-1' } }],
  }
  return entry
}

export function createOptimizationSdk(overrides: OptimizationSdkOverrides = {}): OptimizationSdk {
  const { states: stateOverrides, tracking: trackingOverrides, ...sdkOverrides } = overrides

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
    resolveOptimizedEntry: (entry: Entry) => ({ entry }),
    reset: () => undefined,
    states: {
      blockedEventStream: createObservable(undefined),
      canOptimize: createObservable(false),
      consent: createObservable(undefined),
      eventStream: createObservable(undefined),
      flag: () => createObservable(undefined),
      previewPanelAttached: createObservable(false),
      previewPanelOpen: createObservable(false),
      profile: createObservable(undefined),
      selectedOptimizations: createObservable(undefined),
      ...stateOverrides,
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
      ...trackingOverrides,
    },
    ...sdkOverrides,
  }
}

export function createRuntime(resolveOptimizedEntry: ResolveOptimizedEntry): {
  emit: (value: SelectedOptimizationState) => Promise<void>
  optimization: RuntimeOptimization
} {
  const selectedOptimizationSubscribers = new Set<RuntimeSubscriber<SelectedOptimizationState>>()
  const canOptimizeSubscribers = new Set<RuntimeSubscriber<boolean>>()
  let current: SelectedOptimizationState = undefined
  let canOptimize = false

  const optimization = createOptimizationSdk({
    resolveOptimizedEntry,
    states: {
      canOptimize: {
        get current() {
          return canOptimize
        },
        subscribe(next: RuntimeSubscriber<boolean>) {
          canOptimizeSubscribers.add(next)
          next(canOptimize)

          return {
            unsubscribe() {
              canOptimizeSubscribers.delete(next)
            },
          }
        },
        subscribeOnce(next: RuntimeSubscriber<boolean>) {
          next(canOptimize)
          return { unsubscribe: () => undefined }
        },
      },
      selectedOptimizations: {
        get current() {
          return current
        },
        subscribe(next: RuntimeSubscriber<SelectedOptimizationState>) {
          selectedOptimizationSubscribers.add(next)
          next(current)

          return {
            unsubscribe() {
              selectedOptimizationSubscribers.delete(next)
            },
          }
        },
        subscribeOnce(next: (value: NonNullable<SelectedOptimizationState>) => void) {
          if (current !== undefined) {
            next(current)
          }
          return { unsubscribe: () => undefined }
        },
      },
    },
  }) as RuntimeOptimization

  async function emit(value: SelectedOptimizationState): Promise<void> {
    current = value
    canOptimize = value !== undefined

    await act(async () => {
      await Promise.resolve()
      canOptimizeSubscribers.forEach((subscriber) => {
        subscriber(canOptimize)
      })
      selectedOptimizationSubscribers.forEach((subscriber) => {
        subscriber(value)
      })
    })
  }

  return { emit, optimization }
}

export function defaultLiveUpdatesContext(): LiveUpdatesContextValue {
  return {
    globalLiveUpdates: false,
    previewPanelVisible: false,
    setPreviewPanelVisible() {
      return undefined
    },
  }
}

export async function renderWithOptimizationProviders(
  node: ReactNode,
  optimization: OptimizationSdk,
  liveUpdatesContext = defaultLiveUpdatesContext(),
): Promise<{ container: HTMLDivElement; unmount: () => Promise<void> }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    await Promise.resolve()
    root.render(
      <OptimizationContext.Provider value={{ sdk: optimization, isReady: true, error: undefined }}>
        <LiveUpdatesContext.Provider value={liveUpdatesContext}>{node}</LiveUpdatesContext.Provider>
      </OptimizationContext.Provider>,
    )
  })

  return {
    container,
    async unmount() {
      await act(async () => {
        await Promise.resolve()
        root.unmount()
      })
      container.remove()
    },
  }
}

export function renderWithOptimizationProvidersToString(
  node: ReactNode,
  optimization: OptimizationSdk,
  liveUpdatesContext = defaultLiveUpdatesContext(),
): string {
  return renderToString(
    <OptimizationContext.Provider value={{ sdk: optimization, isReady: true, error: undefined }}>
      <LiveUpdatesContext.Provider value={liveUpdatesContext}>{node}</LiveUpdatesContext.Provider>
    </OptimizationContext.Provider>,
  )
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

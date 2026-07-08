import ContentfulOptimization from '@contentful/optimization-web'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type {
  ContentfulEntryQuery,
  EventEmissionResult,
  ExperienceRequestState,
  ResolvedData,
} from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import type { ReactElement, ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { LiveUpdatesContextValue } from '../context/LiveUpdatesContext'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import type { OptimizationContextValue, OptimizationSdk } from '../context/OptimizationContext'
import { OptimizationContext } from '../context/OptimizationContext'

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
type OptimizationSdkPublic = Pick<OptimizationSdk, keyof OptimizationSdk>
type EventMethodOverride<TMethod extends (...args: never[]) => Promise<EventEmissionResult>> = (
  ...args: Parameters<TMethod>
) => Promise<Awaited<ReturnType<TMethod>> | undefined>

export type RuntimeOptimization = OptimizationSdk

export type OptimizationSdkOverrides = Omit<
  Partial<OptimizationSdkPublic>,
  | 'identify'
  | 'fetchContentfulEntries'
  | 'fetchContentfulEntry'
  | 'page'
  | 'prefetchManagedEntries'
  | 'resolveOptimizedEntry'
  | 'screen'
  | 'states'
  | 'track'
  | 'tracking'
  | 'trackView'
> & {
  fetchContentfulEntries?: (entries: readonly unknown[]) => Promise<Entry[]>
  fetchContentfulEntry?: (entryId: string, query?: ContentfulEntryQuery) => Promise<Entry>
  identify?: EventMethodOverride<OptimizationSdk['identify']>
  page?: EventMethodOverride<OptimizationSdk['page']>
  prefetchManagedEntries?: (entries: readonly unknown[]) => Promise<unknown[]>
  resolveOptimizedEntry?: ResolveOptimizedEntry
  screen?: EventMethodOverride<OptimizationSdk['screen']>
  states?: Partial<OptimizationSdk['states']>
  track?: EventMethodOverride<OptimizationSdk['track']>
  tracking?: Partial<OptimizationSdk['tracking']>
  trackView?: EventMethodOverride<OptimizationSdk['trackView']>
}

export function createObservable<T>(current: T): ObservableLike<T> {
  return {
    current,
    subscribe: () => ({ unsubscribe: () => undefined }),
    subscribeOnce: () => ({ unsubscribe: () => undefined }),
  }
}

export function createMutableCloningObservable<T>(initial: T): {
  emit: (value: T) => Promise<void>
  observable: ObservableLike<T>
} {
  const subscribers = new Set<RuntimeSubscriber<T>>()
  let current = structuredClone(initial)

  const observable: ObservableLike<T> = {
    get current() {
      return structuredClone(current)
    },
    subscribe(next: RuntimeSubscriber<T>) {
      subscribers.add(next)
      next(structuredClone(current))

      return {
        unsubscribe() {
          subscribers.delete(next)
        },
      }
    },
    subscribeOnce(next: (value: NonNullable<T>) => void) {
      if (current !== undefined && current !== null) {
        next(structuredClone(current) as NonNullable<T>)
      }
      return { unsubscribe: () => undefined }
    },
  }

  async function emit(value: T): Promise<void> {
    current = structuredClone(value)

    await act(async () => {
      await Promise.resolve()
      subscribers.forEach((subscriber) => {
        subscriber(structuredClone(current))
      })
    })
  }

  return { emit, observable }
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

function toOptimizationSdk<TSdk extends object>(sdk: TSdk): TSdk & OptimizationSdk {
  Object.setPrototypeOf(sdk, ContentfulOptimization.prototype)

  if (!(sdk instanceof ContentfulOptimization)) {
    throw new Error('Expected SDK test double to use the ContentfulOptimization prototype.')
  }

  return sdk
}

function isOptimizationData(value: unknown): value is EventEmissionResult['data'] {
  if (value === null || typeof value !== 'object') return false

  return (
    typeof Reflect.get(value, 'profile') === 'object' &&
    Array.isArray(Reflect.get(value, 'changes')) &&
    Array.isArray(Reflect.get(value, 'selectedOptimizations'))
  )
}

function toEventEmissionResult(value: unknown): EventEmissionResult {
  if (value !== null && typeof value === 'object') {
    const accepted = Reflect.get(value, 'accepted')

    if (typeof accepted === 'boolean') {
      if (!accepted) return { accepted: false }

      const data = Reflect.get(value, 'data')

      return isOptimizationData(data) ? { accepted: true, data } : { accepted: true }
    }
  }

  if (isOptimizationData(value)) return { accepted: true, data: value }

  return { accepted: true }
}

function getManagedEntryDescriptorId(entry: unknown): string {
  if (typeof entry === 'string') return entry

  if (entry !== null && typeof entry === 'object' && 'entryId' in entry) {
    return String(entry.entryId)
  }

  return String(undefined)
}

export function createOptimizationSdk(overrides: OptimizationSdkOverrides = {}): OptimizationSdk {
  const { states: stateOverrides, tracking: trackingOverrides, ...sdkOverrides } = overrides
  const hasConsent = sdkOverrides.hasConsent ?? (() => true)
  const page =
    sdkOverrides.page ??
    (async () => {
      await Promise.resolve()
      return { accepted: true }
    })
  let acceptedRouteKey: string | undefined = undefined
  let inFlightRouteKey: string | undefined = undefined
  const trackCurrentPage =
    sdkOverrides.trackCurrentPage ??
    (async ({ buildPayload, initialPageEvent = 'emit', routeKey }) => {
      if (initialPageEvent === 'skip' && acceptedRouteKey === undefined) {
        acceptedRouteKey = routeKey
        return { accepted: true }
      }

      if (!hasConsent('page') || acceptedRouteKey === routeKey || inFlightRouteKey === routeKey) {
        return { accepted: false }
      }

      const isInitialEmission = acceptedRouteKey === undefined
      inFlightRouteKey = routeKey

      try {
        const result = toEventEmissionResult(await page(buildPayload({ isInitialEmission })))
        if (result.accepted) {
          acceptedRouteKey = routeKey
        }

        return result
      } finally {
        if (inFlightRouteKey === routeKey) {
          inFlightRouteKey = undefined
        }
      }
    })

  const sdk = {
    consent: () => undefined,
    destroy: () => undefined,
    flush: async () => {
      await Promise.resolve()
    },
    fetchContentfulEntry: async (entryId: string) =>
      await Promise.resolve(createTestEntry(entryId)),
    fetchContentfulEntries: async (entries: readonly unknown[]) =>
      await Promise.resolve(
        entries.map((entry) => createTestEntry(getManagedEntryDescriptorId(entry))),
      ),
    getFlag: () => undefined,
    getMergeTagValue: () => undefined,
    hasConsent,
    identify: async () => {
      await Promise.resolve()
      return { accepted: true }
    },
    locale: undefined,
    page,
    prefetchManagedEntries: async () => await Promise.resolve([]),
    resolveOptimizedEntry: (entry: Entry) => ({ entry }),
    reset: () => undefined,
    screen: async () => {
      await Promise.resolve()
      return { accepted: true }
    },
    setLocale: () => undefined,
    states: {
      locale: createObservable(undefined),
      blockedEventStream: createObservable(undefined),
      canOptimize: createObservable(false),
      optimizationPossible: createObservable(true),
      experienceRequestState: createObservable<ExperienceRequestState>({ status: 'idle' }),
      consent: createObservable(undefined),
      eventStream: createObservable(undefined),
      flag: () => createObservable(undefined),
      persistenceConsent: createObservable(undefined),
      previewPanelAttached: createObservable(false),
      previewPanelOpen: createObservable(false),
      profile: createObservable(undefined),
      selectedOptimizations: createObservable(undefined),
      ...stateOverrides,
    },
    track: async () => {
      await Promise.resolve()
      return { accepted: true }
    },
    trackClick: async () => {
      await Promise.resolve()
      return undefined
    },
    trackFlagView: async () => {
      await Promise.resolve()
    },
    trackHover: async () => {
      await Promise.resolve()
      return undefined
    },
    trackCurrentPage,
    trackView: async () => {
      await Promise.resolve()
      return { accepted: true }
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

  return toOptimizationSdk(sdk)
}

export function createRuntime(
  resolveOptimizedEntry: ResolveOptimizedEntry,
  initialOptimizationPossible = true,
  initialExperienceRequestState: ExperienceRequestState = { status: 'idle' },
): {
  emit: (value: SelectedOptimizationState) => Promise<void>
  setOptimizationPossible: (value: boolean) => Promise<void>
  setExperienceRequestState: (value: ExperienceRequestState) => Promise<void>
  optimization: RuntimeOptimization
} {
  const selectedOptimizationSubscribers = new Set<RuntimeSubscriber<SelectedOptimizationState>>()
  const canOptimizeSubscribers = new Set<RuntimeSubscriber<boolean>>()
  const optimizationPossibleSubscribers = new Set<RuntimeSubscriber<boolean>>()
  const experienceRequestStateSubscribers = new Set<RuntimeSubscriber<ExperienceRequestState>>()
  let current: SelectedOptimizationState = undefined
  let canOptimize = false
  let optimizationPossible = initialOptimizationPossible
  let experienceRequestStateValue: ExperienceRequestState = initialExperienceRequestState

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
      optimizationPossible: {
        get current() {
          return optimizationPossible
        },
        subscribe(next: RuntimeSubscriber<boolean>) {
          optimizationPossibleSubscribers.add(next)
          next(optimizationPossible)

          return {
            unsubscribe() {
              optimizationPossibleSubscribers.delete(next)
            },
          }
        },
        subscribeOnce(next: RuntimeSubscriber<boolean>) {
          next(optimizationPossible)
          return { unsubscribe: () => undefined }
        },
      },
      experienceRequestState: {
        get current() {
          return experienceRequestStateValue
        },
        subscribe(next: RuntimeSubscriber<ExperienceRequestState>) {
          experienceRequestStateSubscribers.add(next)
          next(experienceRequestStateValue)

          return {
            unsubscribe() {
              experienceRequestStateSubscribers.delete(next)
            },
          }
        },
        subscribeOnce(next: RuntimeSubscriber<ExperienceRequestState>) {
          next(experienceRequestStateValue)
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
  })

  async function emit(value: SelectedOptimizationState): Promise<void> {
    current = value
    canOptimize = value !== undefined
    if (canOptimize) {
      experienceRequestStateValue = { status: 'success' }
    }

    await act(async () => {
      await Promise.resolve()
      canOptimizeSubscribers.forEach((subscriber) => {
        subscriber(canOptimize)
      })
      selectedOptimizationSubscribers.forEach((subscriber) => {
        subscriber(value)
      })
      if (canOptimize) {
        experienceRequestStateSubscribers.forEach((subscriber) => {
          subscriber({ status: 'success' })
        })
      }
    })
  }

  async function setOptimizationPossible(value: boolean): Promise<void> {
    optimizationPossible = value

    await act(async () => {
      await Promise.resolve()
      optimizationPossibleSubscribers.forEach((subscriber) => {
        subscriber(value)
      })
    })
  }

  async function setExperienceRequestState(value: ExperienceRequestState): Promise<void> {
    experienceRequestStateValue = value

    await act(async () => {
      await Promise.resolve()
      experienceRequestStateSubscribers.forEach((subscriber) => {
        subscriber(value)
      })
    })
  }

  return { emit, setOptimizationPossible, setExperienceRequestState, optimization }
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
  optimizationContext: Partial<OptimizationContextValue> = {},
): Promise<{ container: HTMLDivElement; unmount: () => Promise<void> }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    await Promise.resolve()
    root.render(
      <OptimizationContext.Provider
        value={{ sdk: optimization, error: undefined, ...optimizationContext }}
      >
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
  optimizationContext: Partial<OptimizationContextValue> = {},
): string {
  return renderToString(
    <OptimizationContext.Provider
      value={{ sdk: optimization, error: undefined, ...optimizationContext }}
    >
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

export function requireOptimizationSdk(value: OptimizationSdk | undefined): OptimizationSdk {
  if (value === undefined) {
    throw new Error('Expected optimization instance to be captured')
  }

  return value
}

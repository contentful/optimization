import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { LiveUpdatesContextValue } from '../context/LiveUpdatesContext'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import { OptimizationContext, type OptimizationSdk } from '../context/OptimizationContext'

export type TestEntry = Entry
export type SelectedPersonalizationState = SelectedPersonalizationArray | undefined
export type PersonalizeEntry = (
  entry: TestEntry,
  selectedPersonalizations: SelectedPersonalizationState,
) => ResolvedData<EntrySkeletonType>
type SelectedPersonalizationsSubscriber = (value: SelectedPersonalizationState) => void
type CanPersonalizeSubscriber = (value: boolean) => void

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

export interface RuntimeOptimization extends OptimizationSdk {
  personalizeEntry: PersonalizeEntry
  states: OptimizationSdk['states'] & {
    canPersonalize: {
      subscribe: (next: CanPersonalizeSubscriber) => { unsubscribe: () => void }
    }
    selectedPersonalizations: {
      current: SelectedPersonalizationState
      subscribe: (next: SelectedPersonalizationsSubscriber) => { unsubscribe: () => void }
    }
  }
}

export function makeEntry(id: string): TestEntry {
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

export function makePersonalizableEntry(id: string): TestEntry {
  const entry = makeEntry(id)
  entry.fields = {
    ...entry.fields,
    nt_experiences: [{ sys: { id: 'exp-1' } }],
  }
  return entry
}

export function createRuntime(personalizeEntry: PersonalizeEntry): {
  emit: (value: SelectedPersonalizationState) => Promise<void>
  optimization: RuntimeOptimization
} {
  const subscribers = new Set<SelectedPersonalizationsSubscriber>()
  const canPersonalizeSubscribers = new Set<CanPersonalizeSubscriber>()
  let current: SelectedPersonalizationState = undefined
  let canPersonalize = false

  const optimization: RuntimeOptimization = {
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
    personalizeEntry,
    reset: () => undefined,
    states: {
      blockedEventStream: createObservable(undefined),
      canPersonalize: {
        get current() {
          return canPersonalize
        },
        subscribe(next: CanPersonalizeSubscriber) {
          canPersonalizeSubscribers.add(next)
          next(canPersonalize)

          return {
            unsubscribe() {
              canPersonalizeSubscribers.delete(next)
            },
          }
        },
        subscribeOnce(next: CanPersonalizeSubscriber) {
          next(canPersonalize)
          return { unsubscribe: () => undefined }
        },
      },
      consent: createObservable(undefined),
      eventStream: createObservable(undefined),
      flag: () => createObservable(undefined),
      previewPanelAttached: createObservable(false),
      previewPanelOpen: createObservable(false),
      profile: createObservable(undefined),
      selectedPersonalizations: {
        get current() {
          return current
        },
        subscribe(next: SelectedPersonalizationsSubscriber) {
          subscribers.add(next)
          next(current)

          return {
            unsubscribe() {
              subscribers.delete(next)
            },
          }
        },
        subscribeOnce(next: (value: NonNullable<SelectedPersonalizationState>) => void) {
          if (current !== undefined) {
            next(current)
          }
          return { unsubscribe: () => undefined }
        },
      },
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
  }

  async function emit(value: SelectedPersonalizationState): Promise<void> {
    current = value
    canPersonalize = value !== undefined

    await act(async () => {
      await Promise.resolve()
      canPersonalizeSubscribers.forEach((subscriber) => {
        subscriber(canPersonalize)
      })
      subscribers.forEach((subscriber) => {
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

export async function renderComponent(
  node: ReactNode,
  optimization: RuntimeOptimization,
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

export function renderComponentToString(
  node: ReactNode,
  optimization: RuntimeOptimization,
  liveUpdatesContext = defaultLiveUpdatesContext(),
): string {
  return renderToString(
    <OptimizationContext.Provider value={{ sdk: optimization, isReady: true, error: undefined }}>
      <LiveUpdatesContext.Provider value={liveUpdatesContext}>{node}</LiveUpdatesContext.Provider>
    </OptimizationContext.Provider>,
  )
}

export function renderToStringWithoutWindow(render: () => string): string {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')

  if (!descriptor?.configurable) {
    throw new TypeError('Expected global window descriptor to be configurable in test runtime')
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: undefined,
  })

  try {
    return render()
  } finally {
    Object.defineProperty(globalThis, 'window', descriptor)
  }
}

export function getWrapper(container: HTMLElement): HTMLElement {
  const { firstElementChild: wrapper } = container

  if (!(wrapper instanceof HTMLElement)) {
    throw new TypeError('Expected first child to be an HTMLElement')
  }

  return wrapper
}

export function getRequiredElement(container: HTMLElement, selector: string): HTMLElement {
  const target = container.querySelector(selector)

  if (!(target instanceof HTMLElement)) {
    throw new TypeError(`Expected selector "${selector}" to resolve to an HTMLElement`)
  }

  return target
}

export function readTitle(entry: TestEntry): string {
  const {
    fields: { title },
  } = entry
  return typeof title === 'string' ? title : ''
}

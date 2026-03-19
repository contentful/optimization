import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { LiveUpdatesContextValue } from '../context/LiveUpdatesContext'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import { OptimizationContext, type OptimizationSdk } from '../context/OptimizationContext'
import { useOptimizedEntry, type UseOptimizedEntryResult } from './useOptimizedEntry'

type TestEntry = Entry
type PersonalizationState = SelectedPersonalizationArray | undefined
type PersonalizeEntry = (
  entry: TestEntry,
  personalizations: PersonalizationState,
) => ResolvedData<EntrySkeletonType>
type SelectedPersonalizationsSubscriber = (value: PersonalizationState) => void
type CanPersonalizeSubscriber = (value: boolean) => void

function createObservable<T>(current: T): {
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

function makeEntry(id: string): TestEntry {
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

function makePersonalizableEntry(id: string): TestEntry {
  const entry = makeEntry(id)
  entry.fields = {
    ...entry.fields,
    nt_experiences: [{ sys: { id: 'exp-1' } }],
  }
  return entry
}

function defaultLiveUpdatesContext(): LiveUpdatesContextValue {
  return {
    globalLiveUpdates: false,
    previewPanelVisible: false,
    setPreviewPanelVisible() {
      return undefined
    },
  }
}

function createRuntime(personalizeEntry: PersonalizeEntry): {
  emit: (value: PersonalizationState) => Promise<void>
  optimization: OptimizationSdk
} {
  const subscribers = new Set<SelectedPersonalizationsSubscriber>()
  const canPersonalizeSubscribers = new Set<CanPersonalizeSubscriber>()
  let current: PersonalizationState = undefined
  let canPersonalize = false

  const optimization: OptimizationSdk = {
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
        subscribeOnce(next: (value: NonNullable<PersonalizationState>) => void) {
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

  async function emit(value: PersonalizationState): Promise<void> {
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

async function renderHook(params: {
  baselineEntry: Entry
  liveUpdates?: boolean
  optimization: OptimizationSdk
  liveUpdatesContext?: LiveUpdatesContextValue
}): Promise<{ getResult: () => UseOptimizedEntryResult; unmount: () => Promise<void> }> {
  const {
    baselineEntry,
    liveUpdates,
    optimization,
    liveUpdatesContext = defaultLiveUpdatesContext(),
  } = params
  let captured: UseOptimizedEntryResult | undefined = undefined
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  function Probe(): null {
    captured = useOptimizedEntry({ baselineEntry, liveUpdates })
    return null
  }

  await act(async () => {
    await Promise.resolve()
    root.render(
      <OptimizationContext.Provider value={{ sdk: optimization, isReady: true, error: undefined }}>
        <LiveUpdatesContext.Provider value={liveUpdatesContext}>
          <Probe />
        </LiveUpdatesContext.Provider>
      </OptimizationContext.Provider>,
    )
  })

  return {
    getResult() {
      if (!captured) {
        throw new Error('Expected hook result to be captured')
      }

      return captured
    },
    async unmount() {
      await act(async () => {
        await Promise.resolve()
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('useOptimizedEntry', () => {
  it('returns baseline state before personalization is available', async () => {
    const baselineEntry = makePersonalizableEntry('baseline')
    const { optimization } = createRuntime((entry) => ({ entry }))
    const rendered = await renderHook({ baselineEntry, optimization })

    expect(rendered.getResult()).toMatchObject({
      entry: baselineEntry,
      personalization: undefined,
      isLoading: true,
      isReady: true,
      canPersonalize: false,
      selectedPersonalizations: undefined,
    })

    await rendered.unmount()
  })

  it('returns resolved variant data once personalizations are available', async () => {
    const baselineEntry = makePersonalizableEntry('baseline')
    const variantEntry = makeEntry('variant-a')
    const variantState: SelectedPersonalizationArray = [
      {
        experienceId: 'exp-hero',
        sticky: true,
        variantIndex: 1,
        variants: { baseline: 'variant-a' },
      },
    ]
    const { emit, optimization } = createRuntime((entry, personalizations) => ({
      entry: personalizations ? variantEntry : entry,
      personalization: personalizations?.[0],
    }))
    const rendered = await renderHook({ baselineEntry, optimization })

    await emit(variantState)

    expect(rendered.getResult()).toMatchObject({
      entry: variantEntry,
      personalization: variantState[0],
      isLoading: false,
      canPersonalize: true,
      selectedPersonalizations: variantState,
    })

    await rendered.unmount()
  })

  it('locks on the first personalization when live updates are disabled', async () => {
    const baselineEntry = makePersonalizableEntry('baseline')
    const variantOne = makeEntry('variant-a')
    const variantTwo = makeEntry('variant-b')
    const variantOneState: SelectedPersonalizationArray = [
      {
        experienceId: 'exp-hero',
        sticky: true,
        variantIndex: 1,
        variants: { baseline: 'variant-a' },
      },
    ]
    const variantTwoState: SelectedPersonalizationArray = [
      {
        experienceId: 'exp-hero',
        sticky: false,
        variantIndex: 2,
        variants: { baseline: 'variant-b' },
      },
    ]
    const { emit, optimization } = createRuntime((entry, personalizations) => ({
      entry:
        personalizations?.[0]?.variantIndex === 1
          ? variantOne
          : personalizations?.[0]?.variantIndex === 2
            ? variantTwo
            : entry,
      personalization: personalizations?.[0],
    }))
    const rendered = await renderHook({ baselineEntry, optimization })

    await emit(variantOneState)
    expect(rendered.getResult().entry).toEqual(variantOne)

    await emit(variantTwoState)
    expect(rendered.getResult().entry).toEqual(variantOne)
    expect(rendered.getResult().selectedPersonalizations).toEqual(variantOneState)

    await rendered.unmount()
  })

  it('follows personalization changes when live updates are enabled', async () => {
    const baselineEntry = makePersonalizableEntry('baseline')
    const variantOne = makeEntry('variant-a')
    const variantTwo = makeEntry('variant-b')
    const variantOneState: SelectedPersonalizationArray = [
      {
        experienceId: 'exp-hero',
        sticky: true,
        variantIndex: 1,
        variants: { baseline: 'variant-a' },
      },
    ]
    const variantTwoState: SelectedPersonalizationArray = [
      {
        experienceId: 'exp-hero',
        sticky: false,
        variantIndex: 2,
        variants: { baseline: 'variant-b' },
      },
    ]
    const { emit, optimization } = createRuntime((entry, personalizations) => ({
      entry:
        personalizations?.[0]?.variantIndex === 1
          ? variantOne
          : personalizations?.[0]?.variantIndex === 2
            ? variantTwo
            : entry,
      personalization: personalizations?.[0],
    }))
    const rendered = await renderHook({ baselineEntry, optimization, liveUpdates: true })

    await emit(variantOneState)
    expect(rendered.getResult().entry).toEqual(variantOne)

    await emit(variantTwoState)
    expect(rendered.getResult().entry).toEqual(variantTwo)
    expect(rendered.getResult().selectedPersonalizations).toEqual(variantTwoState)

    await rendered.unmount()
  })

  it('treats non-personalized entries as ready immediately', async () => {
    const baselineEntry = makeEntry('baseline')
    const { optimization } = createRuntime((entry) => ({ entry }))
    const rendered = await renderHook({ baselineEntry, optimization })

    expect(rendered.getResult()).toMatchObject({
      entry: baselineEntry,
      isLoading: false,
      isReady: true,
      canPersonalize: false,
      personalization: undefined,
      selectedPersonalizations: undefined,
    })

    await rendered.unmount()
  })
})

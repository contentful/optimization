import type {
  ExperienceRequestState,
  Observable,
  ResolvedData,
  Subscription,
} from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import type { Entry, EntrySkeletonType } from 'contentful'
import {
  OPTIMIZED_ENTRY_HOST_DISPLAY,
  OptimizedEntryController,
  resolveOptimizedEntryNestingState,
  type OptimizedEntrySdk,
} from './OptimizedEntryController'

type Subscriber<T> = (value: T) => void

interface TestObservable<T> extends Observable<T> {
  emit: (value: T) => void
  subscriberCount: () => number
}

function createObservable<T>(initialValue: T): TestObservable<T> {
  const subscribers = new Set<Subscriber<T>>()
  let currentValue = initialValue

  return {
    get current() {
      return currentValue
    },
    emit(value: T) {
      currentValue = value
      subscribers.forEach((subscriber) => {
        subscriber(value)
      })
    },
    subscribe(next: Subscriber<T>): Subscription {
      subscribers.add(next)
      next(currentValue)

      return {
        unsubscribe() {
          subscribers.delete(next)
        },
      }
    },
    subscribeOnce(next: (value: NonNullable<T>) => void): Subscription {
      if (currentValue !== undefined && currentValue !== null) {
        next(currentValue)
      }

      return { unsubscribe: () => undefined }
    },
    subscriberCount() {
      return subscribers.size
    },
  }
}

function createTestEntry(id: string): Entry {
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

function createOptimizableTestEntry(id: string): Entry {
  const entry = createTestEntry(id)
  entry.fields = {
    ...entry.fields,
    nt_experiences: [{ sys: { id: 'experience-link' } }],
  }

  return entry
}

function createSdk(
  resolveOptimizedEntry: (
    entry: Entry,
    selectedOptimizations: SelectedOptimizationArray | undefined,
  ) => ResolvedData<EntrySkeletonType>,
  { initialOptimizationPossible = true }: { initialOptimizationPossible?: boolean } = {},
): {
  readonly canOptimize: TestObservable<boolean>
  readonly experienceRequestState: TestObservable<ExperienceRequestState>
  readonly optimizationPossible: TestObservable<boolean>
  readonly sdk: OptimizedEntrySdk
  readonly selectedOptimizations: TestObservable<SelectedOptimizationArray | undefined>
} {
  const selectedOptimizations = createObservable<SelectedOptimizationArray | undefined>(undefined)
  const canOptimize = createObservable(false)
  const experienceRequestState = createObservable<ExperienceRequestState>({ status: 'idle' })
  const optimizationPossible = createObservable(initialOptimizationPossible)

  return {
    canOptimize,
    experienceRequestState,
    optimizationPossible,
    sdk: {
      fetchContentfulEntry: async (entryId: string) =>
        await Promise.resolve(createTestEntry(entryId)),
      resolveOptimizedEntry,
      states: {
        canOptimize,
        experienceRequestState,
        optimizationPossible,
        selectedOptimizations,
      },
    },
    selectedOptimizations,
  }
}

describe('OptimizedEntryController', () => {
  const baseline = createTestEntry('4ib0hsHWoSOnCVdDkizE8d')
  const optimizedBaseline = createOptimizableTestEntry('6KfLDCdA75BGwr5HfSeXac')
  const variantA = createTestEntry('4k6ZyFQnR2POY5IJLLlJRb')
  const variantB = createTestEntry('2qVK4T5lnScbswoyBuGipd')

  const variantOneState: SelectedOptimizationArray = [
    {
      experienceId: '6IueRX1pS3iMJncbhUQTba',
      sticky: true,
      variantIndex: 1,
      variants: { '4ib0hsHWoSOnCVdDkizE8d': '4k6ZyFQnR2POY5IJLLlJRb' },
    },
  ]

  const variantTwoState: SelectedOptimizationArray = [
    {
      experienceId: '6IueRX1pS3iMJncbhUQTba',
      sticky: false,
      variantIndex: 2,
      variants: { '4ib0hsHWoSOnCVdDkizE8d': '2qVK4T5lnScbswoyBuGipd' },
    },
  ]

  afterEach(() => {
    rs.useRealTimers()
  })

  it('exposes the optimized entry host display invariant', () => {
    expect(OPTIMIZED_ENTRY_HOST_DISPLAY).toBe('contents')
  })

  it('resolves duplicate baseline nesting state', () => {
    const ancestorBaselineIds = new Set(['3Z2hP4vR8sT1nY6mK9qL0a', '5mN8rY2pL6qT9vW3xA4bCd'])

    expect(
      resolveOptimizedEntryNestingState('7pQ2rS5tU8vW1xY4zA6bCd', ancestorBaselineIds),
    ).toEqual({
      currentAndAncestorBaselineIds: new Set([
        '3Z2hP4vR8sT1nY6mK9qL0a',
        '5mN8rY2pL6qT9vW3xA4bCd',
        '7pQ2rS5tU8vW1xY4zA6bCd',
      ]),
      hasDuplicateBaselineAncestor: false,
    })

    expect(
      resolveOptimizedEntryNestingState('5mN8rY2pL6qT9vW3xA4bCd', ancestorBaselineIds),
    ).toEqual({
      currentAndAncestorBaselineIds: ancestorBaselineIds,
      hasDuplicateBaselineAncestor: true,
    })
  })

  it('creates host attributes from the resolved presentation snapshot', () => {
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations ? variantA : entry,
      optimizationContextId: selectedOptimizations ? 'ctx-1' : undefined,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: baseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
      trackClicks: true,
      trackHovers: false,
    })

    controller.connect()

    expect(controller.getSnapshot()).toMatchObject({
      entry: baseline,
      isResolved: true,
      metadata: {
        baselineEntry: baseline,
        baselineEntryId: '4ib0hsHWoSOnCVdDkizE8d',
        entry: baseline,
        entryId: '4ib0hsHWoSOnCVdDkizE8d',
      },
      hostAttributes: {
        'data-ctfl-entry-id': '4ib0hsHWoSOnCVdDkizE8d',
        'data-ctfl-track-clicks': true,
        'data-ctfl-track-hovers': false,
        'data-ctfl-variant-index': 0,
      },
    })

    runtime.selectedOptimizations.emit(variantOneState)

    expect(controller.getSnapshot()).toMatchObject({
      metadata: {
        baselineEntry: baseline,
        entry: variantA,
        optimizationContextId: 'ctx-1',
        selectedOptimization: variantOneState[0],
        selectedOptimizations: variantOneState,
      },
      hostAttributes: {
        'data-ctfl-entry-id': '4k6ZyFQnR2POY5IJLLlJRb',
        'data-ctfl-optimization-context-id': 'ctx-1',
        'data-ctfl-optimization-id': '6IueRX1pS3iMJncbhUQTba',
        'data-ctfl-sticky': true,
        'data-ctfl-variant-index': 1,
      },
    })

    controller.disconnect()
  })

  it('keeps tracking attributes empty while optimized content is loading', () => {
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations ? variantA : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()

    expect(controller.getSnapshot()).toMatchObject({
      hostAttributes: {},
      isLoading: true,
      loadingPresentation: {
        hideLoadingLayoutTarget: true,
        shouldRenderBaselineWhileLoading: true,
        showLoadingFallback: true,
      },
    })

    runtime.selectedOptimizations.emit(variantOneState)
    runtime.canOptimize.emit(true)
    runtime.experienceRequestState.emit({ status: 'success' })

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantA,
      isLoading: false,
      hostAttributes: {
        'data-ctfl-baseline-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-entry-id': '4k6ZyFQnR2POY5IJLLlJRb',
      },
    })

    controller.disconnect()
  })

  it('keeps server-rendered content visible in preserve-server hydration while state is unresolved', () => {
    const runtime = createSdk((entry) => ({ entry }))
    const controller = new OptimizedEntryController({
      hydration: 'preserve-server',
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()

    expect(controller.getSnapshot()).toMatchObject({
      hostAttributes: {},
      isLoading: true,
      isResolved: false,
      loadingPresentation: {
        hideLoadingLayoutTarget: false,
        showLoadingFallback: false,
      },
    })

    runtime.experienceRequestState.emit({ status: 'success' })

    expect(controller.getSnapshot()).toMatchObject({
      hostAttributes: {
        'data-ctfl-baseline-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-entry-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-variant-index': 0,
      },
      isLoading: false,
      isResolved: true,
    })

    controller.disconnect()
  })

  it('renders server-seeded optimizations without waiting for a client page request', () => {
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations ? variantA : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    runtime.selectedOptimizations.emit(variantOneState)
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantA,
      isLoading: false,
      hostAttributes: {
        'data-ctfl-baseline-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-entry-id': '4k6ZyFQnR2POY5IJLLlJRb',
      },
      selectedOptimizations: variantOneState,
    })

    controller.disconnect()
  })

  it('immediately shows baseline when optimization is not possible (consent undefined, empty allowedEventTypes)', () => {
    const runtime = createSdk((entry) => ({ entry }), { initialOptimizationPossible: false })
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()

    expect(controller.getSnapshot()).toMatchObject({
      isLoading: false,
      entry: optimizedBaseline,
      loadingPresentation: {
        showLoadingFallback: false,
      },
    })

    controller.disconnect()
  })

  it('immediately shows baseline when optimization is not possible (consent false, empty allowedEventTypes)', () => {
    const runtime = createSdk((entry) => ({ entry }), { initialOptimizationPossible: false })
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()

    expect(controller.getSnapshot().isLoading).toBe(false)

    // If consent is later granted (optimizationPossible flips true), revert to loading
    // until the Experience API settles
    runtime.optimizationPossible.emit(true)

    expect(controller.getSnapshot().isLoading).toBe(true)

    runtime.experienceRequestState.emit({ status: 'success' })

    expect(controller.getSnapshot().isLoading).toBe(false)

    controller.disconnect()
  })

  it('reveals baseline presentation after the loading timeout', async () => {
    rs.useFakeTimers()
    const runtime = createSdk((entry) => ({ entry }))
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      hasCustomLoadingFallback: true,
      baselineRevealTimeoutMs: 50,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()

    expect(controller.getSnapshot().loadingPresentation).toMatchObject({
      hideLoadingLayoutTarget: false,
      shouldRenderBaselineWhileLoading: false,
      showLoadingFallback: true,
    })

    await rs.advanceTimersByTimeAsync(50)

    expect(controller.getSnapshot().loadingPresentation).toMatchObject({
      hideLoadingLayoutTarget: false,
      shouldRenderBaselineWhileLoading: true,
      showLoadingFallback: true,
    })

    controller.disconnect()
  })

  it('resets the loading reveal timeout state when the baseline entry changes', async () => {
    rs.useFakeTimers()
    const nextOptimizedBaseline = createOptimizableTestEntry('3Z2hP4vR8sT1nY6mK9qL0a')
    const runtime = createSdk((entry) => ({ entry }))
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      hasCustomLoadingFallback: true,
      baselineRevealTimeoutMs: 50,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    await rs.advanceTimersByTimeAsync(50)

    expect(controller.getSnapshot().loadingPresentation.shouldRenderBaselineWhileLoading).toBe(true)

    controller.updateOptions({
      isPresentationReady: true,
      baselineEntry: nextOptimizedBaseline,
      hasCustomLoadingFallback: true,
      baselineRevealTimeoutMs: 50,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    expect(controller.getSnapshot().loadingPresentation.shouldRenderBaselineWhileLoading).toBe(
      false,
    )

    await rs.advanceTimersByTimeAsync(50)

    expect(controller.getSnapshot().loadingPresentation.shouldRenderBaselineWhileLoading).toBe(true)

    controller.disconnect()
  })

  it('locks selected optimizations unless live updates are enabled', () => {
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry:
        selectedOptimizations?.[0]?.variantIndex === 1
          ? variantA
          : selectedOptimizations?.[0]?.variantIndex === 2
            ? variantB
            : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: baseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    runtime.selectedOptimizations.emit(variantOneState)
    expect(controller.getSnapshot().entry).toBe(variantA)

    runtime.selectedOptimizations.emit(variantTwoState)
    expect(controller.getSnapshot().entry).toBe(variantA)

    controller.updateOptions({
      isPresentationReady: true,
      baselineEntry: baseline,
      isPreviewPanelOpen: true,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    expect(controller.getSnapshot().entry).toBe(variantB)

    controller.disconnect()
  })

  it('resets locked SDK state when the SDK instance changes', () => {
    const firstRuntime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations ? variantA : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const secondRuntime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations ? variantB : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: baseline,
      sdk: firstRuntime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    firstRuntime.selectedOptimizations.emit(variantOneState)
    secondRuntime.selectedOptimizations.emit(variantTwoState)

    expect(controller.getSnapshot().entry).toBe(variantA)

    controller.updateOptions({
      isPresentationReady: true,
      baselineEntry: baseline,
      sdk: secondRuntime.sdk,
      isSdkStateReady: true,
    })

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantB,
      selectedOptimizations: variantTwoState,
    })

    controller.disconnect()
  })

  it('clears SDK-scoped state when the SDK becomes unavailable', () => {
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations ? variantA : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    runtime.selectedOptimizations.emit(variantOneState)
    runtime.canOptimize.emit(true)
    runtime.experienceRequestState.emit({ status: 'success' })

    expect(controller.getSnapshot()).toMatchObject({
      canOptimize: true,
      entry: variantA,
      isLoading: false,
      selectedOptimizations: variantOneState,
    })

    controller.updateOptions({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: false,
    })

    expect(controller.getSnapshot()).toMatchObject({
      canOptimize: false,
      entry: optimizedBaseline,
      hostAttributes: {},
      isLoading: true,
      selectedOptimizations: undefined,
    })

    controller.disconnect()
  })

  it('cleans up SDK subscriptions and timers on disconnect', () => {
    rs.useFakeTimers()
    const runtime = createSdk((entry) => ({ entry }))
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      baselineRevealTimeoutMs: 50,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    expect(runtime.selectedOptimizations.subscriberCount()).toBe(1)
    expect(runtime.canOptimize.subscriberCount()).toBe(1)
    expect(runtime.experienceRequestState.subscriberCount()).toBe(1)

    controller.disconnect()

    expect(runtime.selectedOptimizations.subscriberCount()).toBe(0)
    expect(runtime.canOptimize.subscriberCount()).toBe(0)
    expect(runtime.experienceRequestState.subscriberCount()).toBe(0)
    expect(rs.getTimerCount()).toBe(0)
  })
})

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
): {
  readonly canOptimize: TestObservable<boolean>
  readonly experienceRequestState: TestObservable<ExperienceRequestState>
  readonly sdk: OptimizedEntrySdk
  readonly selectedOptimizations: TestObservable<SelectedOptimizationArray | undefined>
} {
  const selectedOptimizations = createObservable<SelectedOptimizationArray | undefined>(undefined)
  const canOptimize = createObservable(false)
  const experienceRequestState = createObservable<ExperienceRequestState>({ status: 'idle' })

  return {
    canOptimize,
    experienceRequestState,
    sdk: {
      resolveOptimizedEntry,
      states: {
        canOptimize,
        experienceRequestState,
        selectedOptimizations,
      },
    },
    selectedOptimizations,
  }
}

describe('OptimizedEntryController', () => {
  const baseline = createTestEntry('baseline')
  const optimizedBaseline = createOptimizableTestEntry('optimized-baseline')
  const variantA = createTestEntry('variant-a')
  const variantB = createTestEntry('variant-b')

  const variantOneState: SelectedOptimizationArray = [
    {
      experienceId: 'exp-hero',
      sticky: true,
      variantIndex: 1,
      variants: { baseline: 'variant-a' },
    },
  ]

  const variantTwoState: SelectedOptimizationArray = [
    {
      experienceId: 'exp-hero',
      sticky: false,
      variantIndex: 2,
      variants: { baseline: 'variant-b' },
    },
  ]

  afterEach(() => {
    rs.useRealTimers()
  })

  it('exposes the optimized entry host display invariant', () => {
    expect(OPTIMIZED_ENTRY_HOST_DISPLAY).toBe('contents')
  })

  it('resolves duplicate baseline nesting state', () => {
    const ancestorBaselineIds = new Set(['ancestor-baseline', 'duplicate-baseline'])

    expect(resolveOptimizedEntryNestingState('child-baseline', ancestorBaselineIds)).toEqual({
      currentAndAncestorBaselineIds: new Set([
        'ancestor-baseline',
        'duplicate-baseline',
        'child-baseline',
      ]),
      hasDuplicateBaselineAncestor: false,
    })

    expect(resolveOptimizedEntryNestingState('duplicate-baseline', ancestorBaselineIds)).toEqual({
      currentAndAncestorBaselineIds: ancestorBaselineIds,
      hasDuplicateBaselineAncestor: true,
    })
  })

  it('creates host attributes from the resolved presentation snapshot', () => {
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations ? variantA : entry,
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

    expect(controller.getSnapshot().hostAttributes).toMatchObject({
      'data-ctfl-entry-id': 'baseline',
      'data-ctfl-track-clicks': true,
      'data-ctfl-track-hovers': false,
      'data-ctfl-variant-index': 0,
    })

    runtime.selectedOptimizations.emit(variantOneState)

    expect(controller.getSnapshot().hostAttributes).toMatchObject({
      'data-ctfl-entry-id': 'variant-a',
      'data-ctfl-optimization-id': 'exp-hero',
      'data-ctfl-sticky': true,
      'data-ctfl-variant-index': 1,
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
        'data-ctfl-baseline-id': 'optimized-baseline',
        'data-ctfl-entry-id': 'variant-a',
      },
    })

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
    const nextOptimizedBaseline = createOptimizableTestEntry('next-optimized-baseline')
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

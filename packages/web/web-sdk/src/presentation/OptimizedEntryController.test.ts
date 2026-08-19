import type {
  ContentfulEntryQuery,
  ExperienceRequestState,
  ManagedEntryDescriptor,
  Observable,
  OptimizedEntryMetadata,
  ResolvedData,
  Subscription,
} from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import { createOptimizedEntryLoadingEntry } from '@contentful/optimization-core/entry-source'
import type { Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'
import { isEntryOfContentType } from '../api-schemas'
import {
  OPTIMIZED_ENTRY_HOST_DISPLAY,
  OptimizedEntryController,
  resolveOptimizedEntryNestingState,
  type OptimizedEntrySdk,
} from './OptimizedEntryController'
import { resolveOptimizedEntryTrackingAttributes } from './OptimizedEntryTrackingAttributes'

type Subscriber<T> = (value: T) => void

interface TestObservable<T> extends Observable<T> {
  emit: (value: T) => void
  subscriberCount: () => number
}

type PageSkeleton = EntrySkeletonType<{ title: EntryFieldTypes.Symbol }, 'page'>
type HeroSkeleton = EntrySkeletonType<{ headline: EntryFieldTypes.Symbol }, 'hero'>
type CtaSkeleton = EntrySkeletonType<{ label: EntryFieldTypes.Symbol }, 'cta'>
type PossibleSkeleton = PageSkeleton | HeroSkeleton | CtaSkeleton
type Modifier = 'WITHOUT_LINK_RESOLUTION'
type Locale = 'en-US'

function compilePresentationTypes(
  baselineEntry: Entry<PageSkeleton, Modifier, Locale>,
  sdk: OptimizedEntrySdk<PossibleSkeleton, Modifier, Locale>,
): void {
  const snapshot = new OptimizedEntryController<PossibleSkeleton, Modifier, Locale>({
    baselineEntry,
    sdk,
  }).getSnapshot()
  const entry:
    | Entry<PageSkeleton, Modifier, Locale>
    | Entry<HeroSkeleton, Modifier, Locale>
    | Entry<CtaSkeleton, Modifier, Locale> = snapshot.entry
  const resolvedData: ResolvedData<PossibleSkeleton, Modifier, Locale> = snapshot.resolvedData
  const metadata: OptimizedEntryMetadata<PossibleSkeleton, Modifier, Locale> = snapshot.metadata

  resolveOptimizedEntryTrackingAttributes(baselineEntry, resolvedData)

  if (isEntryOfContentType<HeroSkeleton, Modifier, Locale>(entry, 'hero')) {
    void entry.fields.headline
  }

  const sameTypeEntry: Entry<PageSkeleton, Modifier, Locale> = new OptimizedEntryController({
    baselineEntry,
    sdk: undefined,
  }).getSnapshot().entry

  void resolvedData
  void metadata
  void sameTypeEntry
}

void compilePresentationTypes

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
      fetchContentfulEntry: async (
        descriptor: ManagedEntryDescriptor,
        _query?: ContentfulEntryQuery,
      ) =>
        await Promise.resolve(
          createTestEntry(
            typeof descriptor === 'string' ? descriptor : (descriptor.entryId ?? descriptor.slug),
          ),
        ),
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

  function createLiveUpdatesController(): {
    readonly controller: OptimizedEntryController
    readonly runtime: ReturnType<typeof createSdk>
  } {
    const runtime = createSdk((entry, selectedOptimizations) => {
      const selectedOptimization = selectedOptimizations?.[0]

      return {
        entry:
          selectedOptimization?.variantIndex === 1
            ? variantA
            : selectedOptimization?.variantIndex === 2
              ? variantB
              : entry,
        optimizationContextId: selectedOptimization ? 'ctx-live' : undefined,
        selectedOptimization,
      }
    })
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      rootLiveUpdatesEnabled: true,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    runtime.selectedOptimizations.emit(variantOneState)
    runtime.experienceRequestState.emit({ status: 'success' })

    return { controller, runtime }
  }

  afterEach(() => {
    rs.useRealTimers()
    rs.unstubAllGlobals()
  })

  it('exposes the optimized entry host display invariant', () => {
    expect(OPTIMIZED_ENTRY_HOST_DISPLAY).toBe('contents')
    expect(isEntryOfContentType).toBeTypeOf('function')
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
      entryLiveUpdatesEnabled: true,
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

  it('commits preserve-server content without waiting for presentation readiness', () => {
    const runtime = createSdk((entry) => ({ entry }))
    const controller = new OptimizedEntryController({
      hydration: 'preserve-server',
      isPresentationReady: false,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()

    expect(controller.getSnapshot()).toMatchObject({
      hostAttributes: {
        'data-ctfl-baseline-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-entry-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-variant-index': 0,
      },
      isLoading: false,
      isResolved: true,
      loadingPresentation: {
        hideLoadingLayoutTarget: false,
        showLoadingFallback: false,
      },
    })

    runtime.experienceRequestState.emit({ status: 'pending' })

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

  it('keeps the impossible-optimization baseline committed when optimization later becomes possible', () => {
    const runtime = createSdk((entry) => ({ entry }), { initialOptimizationPossible: false })
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()

    expect(controller.getSnapshot().isLoading).toBe(false)

    runtime.optimizationPossible.emit(true)

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      isLoading: false,
      isResolved: true,
      hostAttributes: {
        'data-ctfl-entry-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-variant-index': 0,
      },
    })

    controller.disconnect()
  })

  it('commits an honest baseline presentation after the loading timeout and ignores a late default selection', async () => {
    rs.useFakeTimers()
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations?.length ? variantA : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
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

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      isLoading: false,
      isResolved: true,
      selectedOptimization: undefined,
      selectedOptimizations: undefined,
      hostAttributes: {
        'data-ctfl-baseline-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-entry-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-variant-index': 0,
      },
      loadingPresentation: {
        showLoadingFallback: false,
      },
    })

    runtime.selectedOptimizations.emit(variantOneState)

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      isLoading: false,
      isResolved: true,
      selectedOptimizations: undefined,
      hostAttributes: {
        'data-ctfl-entry-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-variant-index': 0,
      },
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

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      isLoading: false,
      isResolved: true,
    })
    expect(rs.getTimerCount()).toBe(0)

    controller.updateOptions({
      isPresentationReady: true,
      baselineEntry: nextOptimizedBaseline,
      hasCustomLoadingFallback: true,
      baselineRevealTimeoutMs: 50,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    expect(controller.getSnapshot()).toMatchObject({
      entry: nextOptimizedBaseline,
      isLoading: true,
      isResolved: false,
      loadingPresentation: {
        shouldRenderBaselineWhileLoading: false,
      },
    })
    expect(rs.getTimerCount()).toBe(1)

    await rs.advanceTimersByTimeAsync(50)

    expect(controller.getSnapshot()).toMatchObject({
      entry: nextOptimizedBaseline,
      isLoading: false,
      isResolved: true,
    })
    expect(rs.getTimerCount()).toBe(0)

    controller.disconnect()
  })

  it('refreshes the current SDK selection when a new baseline ID starts a presentation', () => {
    const nextOptimizedBaseline = createOptimizableTestEntry('3Z2hP4vR8sT1nY6mK9qL0a')
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
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    runtime.selectedOptimizations.emit(variantOneState)
    runtime.selectedOptimizations.emit(variantTwoState)

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantA,
      selectedOptimizations: variantOneState,
    })

    controller.updateOptions({
      isPresentationReady: true,
      baselineEntry: nextOptimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantB,
      isLoading: false,
      isResolved: true,
      selectedOptimizations: variantTwoState,
      metadata: {
        baselineEntryId: '3Z2hP4vR8sT1nY6mK9qL0a',
      },
    })

    controller.disconnect()
  })

  it('restarts the loading reveal timeout when the SDK instance changes', async () => {
    rs.useFakeTimers()
    const firstRuntime = createSdk((entry) => ({ entry }))
    const secondRuntime = createSdk((entry) => ({ entry }))
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      hasCustomLoadingFallback: true,
      baselineRevealTimeoutMs: 50,
      sdk: firstRuntime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    await rs.advanceTimersByTimeAsync(25)

    controller.updateOptions({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      hasCustomLoadingFallback: true,
      baselineRevealTimeoutMs: 50,
      sdk: secondRuntime.sdk,
      isSdkStateReady: true,
    })

    expect(rs.getTimerCount()).toBe(1)

    await rs.advanceTimersByTimeAsync(25)

    expect(controller.getSnapshot()).toMatchObject({
      isLoading: true,
      isResolved: false,
      loadingPresentation: {
        shouldRenderBaselineWhileLoading: false,
      },
    })

    await rs.advanceTimersByTimeAsync(25)

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      isLoading: false,
      isResolved: true,
    })
    expect(rs.getTimerCount()).toBe(0)

    controller.disconnect()
  })

  it('does not commit a managed-entry loading placeholder before its same-ID baseline arrives', () => {
    const loadingEntry = createOptimizedEntryLoadingEntry(baseline.sys.id)
    const runtime = createSdk((entry) => ({ entry }))
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: loadingEntry,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()

    expect(controller.getSnapshot()).toMatchObject({
      entry: loadingEntry,
      hostAttributes: {},
      isLoading: true,
      isResolved: false,
    })

    controller.updateOptions({
      isPresentationReady: true,
      baselineEntry: baseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    expect(controller.getSnapshot()).toMatchObject({
      entry: baseline,
      isLoading: false,
      isResolved: true,
      hostAttributes: {
        'data-ctfl-entry-id': '4ib0hsHWoSOnCVdDkizE8d',
        'data-ctfl-variant-index': 0,
      },
    })

    controller.disconnect()
  })

  it('does not let a delayed same-ID managed-entry placeholder force a stale timeout fallback', async () => {
    rs.useFakeTimers()
    const loadingEntry = createOptimizedEntryLoadingEntry(optimizedBaseline.sys.id)
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations?.length ? variantA : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: loadingEntry,
      baselineRevealTimeoutMs: 50,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    runtime.selectedOptimizations.emit(variantOneState)
    await rs.advanceTimersByTimeAsync(100)

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantA,
      hostAttributes: {},
      isLoading: true,
      isResolved: false,
      selectedOptimizations: variantOneState,
    })
    expect(rs.getTimerCount()).toBe(0)

    controller.updateOptions({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      baselineRevealTimeoutMs: 50,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantA,
      isLoading: false,
      isResolved: true,
      selectedOptimizations: variantOneState,
      hostAttributes: {
        'data-ctfl-entry-id': '4k6ZyFQnR2POY5IJLLlJRb',
        'data-ctfl-variant-index': 1,
      },
    })
    expect(rs.getTimerCount()).toBe(0)

    controller.disconnect()
  })

  it('keeps a settled-failure baseline committed through later pending state', () => {
    const runtime = createSdk((entry) => ({ entry }))
    const controller = new OptimizedEntryController({
      isPresentationReady: false,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    runtime.experienceRequestState.emit({ status: 'failed', reason: 'api-error' })

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      isLoading: false,
      isResolved: true,
      selectedOptimizations: undefined,
      hostAttributes: {
        'data-ctfl-baseline-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-entry-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-variant-index': 0,
      },
    })

    runtime.selectedOptimizations.emit(variantOneState)

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      isLoading: false,
      isResolved: true,
      selectedOptimizations: undefined,
      hostAttributes: {
        'data-ctfl-entry-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-variant-index': 0,
      },
    })

    runtime.experienceRequestState.emit({ status: 'pending' })

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      isLoading: false,
      isResolved: true,
      hostAttributes: {
        'data-ctfl-entry-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-variant-index': 0,
      },
      loadingPresentation: {
        showLoadingFallback: false,
      },
    })

    controller.disconnect()
  })

  it('holds a later selection while an open browser presentation is not ready', () => {
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations?.length ? variantA : entry,
      optimizationContextId: selectedOptimizations?.length ? 'ctx-1' : undefined,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const controller = new OptimizedEntryController({
      isPresentationReady: false,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    runtime.selectedOptimizations.emit(variantOneState)

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantA,
      hostAttributes: {},
      isLoading: true,
      isResolved: false,
      selectedOptimizations: variantOneState,
      loadingPresentation: {
        showLoadingFallback: true,
      },
    })

    controller.updateOptions({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantA,
      isLoading: false,
      isResolved: true,
      selectedOptimizations: variantOneState,
      hostAttributes: {
        'data-ctfl-entry-id': '4k6ZyFQnR2POY5IJLLlJRb',
        'data-ctfl-optimization-context-id': 'ctx-1',
        'data-ctfl-variant-index': 1,
      },
    })

    controller.disconnect()
  })

  it('does not reopen an existing commitment when browser presentation readiness becomes false', () => {
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations?.length ? variantA : entry,
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

    controller.updateOptions({
      isPresentationReady: false,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantA,
      isLoading: false,
      isPresentationReady: false,
      isResolved: true,
      selectedOptimizations: variantOneState,
      hostAttributes: {
        'data-ctfl-entry-id': '4k6ZyFQnR2POY5IJLLlJRb',
        'data-ctfl-variant-index': 1,
      },
      loadingPresentation: {
        showLoadingFallback: false,
      },
    })

    controller.disconnect()
  })

  it('keeps readiness gating and browser commitment out of server snapshots', () => {
    rs.stubGlobal('window', undefined)
    const runtime = createSdk((entry) => ({ entry }), { initialOptimizationPossible: false })
    const controller = new OptimizedEntryController({
      isPresentationReady: false,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      hostAttributes: {},
      isLoading: false,
      isResolved: false,
      loadingPresentation: {
        hideLoadingLayoutTarget: true,
        showLoadingFallback: true,
      },
    })

    runtime.optimizationPossible.emit(true)

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      hostAttributes: {},
      isLoading: true,
      isResolved: false,
      loadingPresentation: {
        hideLoadingLayoutTarget: true,
        showLoadingFallback: true,
      },
    })

    controller.disconnect()
  })

  it('keeps a pre-existing synchronous seed visible when browser presentation readiness is false', () => {
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations?.length ? variantA : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    runtime.selectedOptimizations.emit(variantOneState)
    const controller = new OptimizedEntryController({
      isPresentationReady: false,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantA,
      isLoading: false,
      isResolved: true,
      selectedOptimizations: variantOneState,
      hostAttributes: {
        'data-ctfl-entry-id': '4k6ZyFQnR2POY5IJLLlJRb',
        'data-ctfl-variant-index': 1,
      },
    })

    controller.disconnect()
  })

  it('keeps a committed live variant through undefined, pending, and failure state', () => {
    const { controller, runtime } = createLiveUpdatesController()

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantA,
      isLoading: false,
      isResolved: true,
      hostAttributes: {
        'data-ctfl-entry-id': '4k6ZyFQnR2POY5IJLLlJRb',
        'data-ctfl-optimization-context-id': 'ctx-live',
        'data-ctfl-variant-index': 1,
      },
    })

    runtime.selectedOptimizations.emit(undefined)
    runtime.experienceRequestState.emit({ status: 'pending' })

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantA,
      isLoading: false,
      isResolved: true,
      selectedOptimizations: variantOneState,
      hostAttributes: {
        'data-ctfl-entry-id': '4k6ZyFQnR2POY5IJLLlJRb',
        'data-ctfl-optimization-context-id': 'ctx-live',
        'data-ctfl-variant-index': 1,
      },
    })

    runtime.experienceRequestState.emit({ status: 'failed', reason: 'api-error' })

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantA,
      isLoading: false,
      isResolved: true,
      selectedOptimizations: variantOneState,
    })

    controller.disconnect()
  })

  it('applies a later defined variant in live mode', () => {
    const { controller, runtime } = createLiveUpdatesController()

    runtime.selectedOptimizations.emit(variantTwoState)

    expect(controller.getSnapshot()).toMatchObject({
      entry: variantB,
      selectedOptimizations: variantTwoState,
      hostAttributes: {
        'data-ctfl-entry-id': '2qVK4T5lnScbswoyBuGipd',
        'data-ctfl-variant-index': 2,
      },
    })

    controller.disconnect()
  })

  it('resolves a live empty selection to baseline content and tracking', () => {
    const { controller, runtime } = createLiveUpdatesController()

    runtime.selectedOptimizations.emit([])

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      isLoading: false,
      isResolved: true,
      selectedOptimization: undefined,
      selectedOptimizations: [],
      hostAttributes: {
        'data-ctfl-baseline-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-entry-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-optimization-context-id': undefined,
        'data-ctfl-optimization-id': undefined,
        'data-ctfl-variant-index': 0,
      },
    })

    controller.disconnect()
  })

  it('keeps a committed live empty selection through undefined, pending, and failure state', () => {
    const { controller, runtime } = createLiveUpdatesController()

    runtime.selectedOptimizations.emit([])

    runtime.selectedOptimizations.emit(undefined)
    runtime.experienceRequestState.emit({ status: 'pending' })

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      isLoading: false,
      isResolved: true,
      selectedOptimizations: [],
      hostAttributes: {
        'data-ctfl-entry-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-variant-index': 0,
      },
    })

    runtime.experienceRequestState.emit({ status: 'failed', reason: 'timeout' })

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      isLoading: false,
      isResolved: true,
      selectedOptimizations: [],
    })

    controller.disconnect()
  })

  it('commits a defined selected-baseline result under default non-live behavior', () => {
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const controller = new OptimizedEntryController({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
      sdk: runtime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    runtime.selectedOptimizations.emit([])

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      isLoading: false,
      isResolved: true,
      selectedOptimization: undefined,
      selectedOptimizations: [],
      hostAttributes: {
        'data-ctfl-entry-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-variant-index': 0,
      },
    })

    runtime.selectedOptimizations.emit(variantOneState)

    expect(controller.getSnapshot()).toMatchObject({
      entry: optimizedBaseline,
      selectedOptimizations: [],
      hostAttributes: {
        'data-ctfl-entry-id': '6KfLDCdA75BGwr5HfSeXac',
        'data-ctfl-variant-index': 0,
      },
    })

    controller.disconnect()
  })

  it('locks a selected commitment unless preview forces live updates', () => {
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
      baselineEntry: optimizedBaseline,
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
      baselineEntry: optimizedBaseline,
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
      baselineEntry: optimizedBaseline,
      sdk: firstRuntime.sdk,
      isSdkStateReady: true,
    })

    controller.connect()
    firstRuntime.selectedOptimizations.emit(variantOneState)
    secondRuntime.selectedOptimizations.emit(variantTwoState)

    expect(controller.getSnapshot().entry).toBe(variantA)

    controller.updateOptions({
      isPresentationReady: true,
      baselineEntry: optimizedBaseline,
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

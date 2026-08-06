import type {
  MergeTagEntry,
  OptimizationData,
  SelectedOptimizationArray,
} from '@contentful/optimization-web/api-schemas'
import type {
  EntryFor,
  OptimizedEntryMetadata,
  ResolvedData,
} from '@contentful/optimization-web/core-sdk'
import type { ContentOptimizationHandoff } from '@contentful/optimization-web/handoff'
import type { Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'
import { act, createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { isEntryOfContentType } from '../api-schemas'
import { OptimizationHydrationContext } from '../context/OptimizationHydrationContext'
import { useEntryResolver } from '../hooks/useEntryResolver'
import { OptimizationRoot } from '../root/OptimizationRoot'
import { OptimizedEntry, type OptimizedEntryProps } from './OptimizedEntry'
import {
  createOptimizationSdk,
  createRuntime,
  getRequiredElement,
  getWrapper,
  makeEntry,
  makeOptimizableEntry,
  readTitle,
  renderComponent,
  renderComponentToString,
  renderToStringWithoutWindow,
  type TestEntry,
} from './OptimizedEntry.testUtils'
import { useOptimizedEntry, type UseOptimizedEntryResult } from './useOptimizedEntry'

type PageSkeleton = EntrySkeletonType<{ title: EntryFieldTypes.Symbol }, 'page'>
type HeroSkeleton = EntrySkeletonType<{ headline: EntryFieldTypes.Symbol }, 'hero'>
type CtaSkeleton = EntrySkeletonType<{ label: EntryFieldTypes.Symbol }, 'cta'>
type PossibleSkeleton = PageSkeleton | HeroSkeleton | CtaSkeleton
type Modifier = 'WITHOUT_LINK_RESOLUTION'
type Locale = 'en-US'

function compileOptimizedEntryTypes(baselineEntry: Entry<PageSkeleton, Modifier, Locale>): void {
  const inferred = useOptimizedEntry({ baselineEntry })
  const sameType: Entry<PageSkeleton, Modifier, Locale> = inferred.entry
  const result = useOptimizedEntry<PossibleSkeleton, Modifier, Locale>({ baselineEntry })
  const typedResult: UseOptimizedEntryResult<EntryFor<PossibleSkeleton, Modifier, Locale>> = result
  const _distributed:
    | Entry<PageSkeleton, Modifier, Locale>
    | Entry<HeroSkeleton, Modifier, Locale>
    | Entry<CtaSkeleton, Modifier, Locale> = result.entry
  const _metadata: OptimizedEntryMetadata<PossibleSkeleton, Modifier, Locale> | undefined =
    result.metadata
  const _resolvedData: ResolvedData<PossibleSkeleton, Modifier, Locale> = result.resolvedData
  const managedEntry: EntryFor<PossibleSkeleton, undefined, Locale> | undefined = useOptimizedEntry<
    PossibleSkeleton,
    Locale
  >({ entryId: 'page' }).entry
  const managedSlugEntry: EntryFor<PossibleSkeleton, undefined, Locale> | undefined =
    useOptimizedEntry<PossibleSkeleton, Locale>({
      managedEntry: { contentType: 'page', slug: 'home' },
    }).entry

  // @ts-expect-error -- baseline and managed sources are mutually exclusive.
  useOptimizedEntry({ baselineEntry, managedEntry: { contentType: 'page', slug: 'home' } })
  // @ts-expect-error -- ID and object-descriptor sources are mutually exclusive.
  useOptimizedEntry({ entryId: 'page', managedEntry: { contentType: 'page', slug: 'home' } })
  // @ts-expect-error -- flat slug source params are not supported.
  useOptimizedEntry({ contentType: 'page' })

  OptimizedEntry<PossibleSkeleton, Modifier, Locale>({
    baselineEntry,
    children: (entry, context) => {
      const renderedEntry: typeof _distributed = entry
      const renderedMetadata: NonNullable<typeof _metadata> = context

      return isEntryOfContentType<HeroSkeleton, Modifier, Locale>(entry, 'hero')
        ? entry.fields.headline
        : `${renderedMetadata.entryId}:${renderedEntry.sys.id}`
    },
  })
  OptimizedEntry<PossibleSkeleton, Locale>({
    entryId: 'page',
    children: (entry) => entry.sys.id,
  })
  OptimizedEntry<PossibleSkeleton, Locale>({
    managedEntry: { contentType: 'page', slug: 'home' },
    children: (entry) => entry.sys.id,
  })
  // @ts-expect-error -- component ID and object-descriptor sources are mutually exclusive.
  OptimizedEntry({
    entryId: 'page',
    managedEntry: { contentType: 'page', slug: 'home' },
    children: null,
  })
  // @ts-expect-error -- component baseline and managed sources are mutually exclusive.
  OptimizedEntry({
    baselineEntry,
    managedEntry: { contentType: 'page', slug: 'home' },
    children: null,
  })
  const resolver = useEntryResolver()
  const resolverEntry: typeof _distributed = resolver.resolveEntry<
    PossibleSkeleton,
    Modifier,
    Locale
  >(baselineEntry)
  const resolverData: typeof _resolvedData = resolver.resolveEntryData<
    PossibleSkeleton,
    Modifier,
    Locale
  >(baselineEntry)

  void managedEntry
  void managedSlugEntry
  void resolverData
  void resolverEntry
  void sameType
  void typedResult
}

void compileOptimizedEntryTypes

function createDeferred<T>(): {
  readonly promise: Promise<T>
  readonly reject: (reason?: unknown) => void
  readonly resolve: (value: T) => void
} {
  let resolveDeferred: (value: T) => void = () => undefined
  let rejectDeferred: (reason?: unknown) => void = () => undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve
    rejectDeferred = reject
  })

  return { promise, reject: rejectDeferred, resolve: resolveDeferred }
}

describe('OptimizedEntry', () => {
  const baseline = makeEntry('4ib0hsHWoSOnCVdDkizE8d')
  const optimizedBaseline = makeOptimizableEntry('6KfLDCdA75BGwr5HfSeXac')
  const variantA = makeEntry('4k6ZyFQnR2POY5IJLLlJRb')
  const variantB = makeEntry('2qVK4T5lnScbswoyBuGipd')

  const baselineParent = makeEntry('3Z2hP4vR8sT1nY6mK9qL0a')
  const variantParent = makeEntry('5mN8rY2pL6qT9vW3xA4bCd')
  const baselineChild = makeEntry('7pQ2rS5tU8vW1xY4zA6bCd')
  const variantChild = makeEntry('9sT4uV7wX0yZ3aB6cD8eFg')

  function makeMergeTagEntry(id: string): MergeTagEntry {
    const entry = makeEntry(id)
    const mergeTagEntry: MergeTagEntry = {
      ...entry,
      fields: {
        nt_mergetag_id: 'traits.continent',
        nt_name: id,
      },
      sys: {
        ...entry.sys,
        contentType: {
          sys: {
            id: 'nt_mergetag',
            linkType: 'ContentType',
            type: 'Link',
          },
        },
      },
    }
    return mergeTagEntry
  }

  function createServerOptimizationState(): OptimizationData {
    return {
      changes: [],
      selectedOptimizations: [],
      profile: {
        id: 'f0837d7dc6344c36a3a0a06c4cde754b',
        stableId: 'f0837d7dc6344c36a3a0a06c4cde754b',
        random: 0.5,
        audiences: [],
        traits: {},
        location: {},
        session: {
          id: 'e77eab64-93ca-4f6e-8492-037c1ff67caa',
          isReturningVisitor: false,
          landingPage: {
            path: '/',
            query: {},
            referrer: '',
            search: '',
            title: '',
            url: 'https://example.test/',
          },
          count: 1,
          activeSessionLength: 0,
          averageSessionLength: 0,
        },
      },
    }
  }

  function createContentHandoff(
    overrides: Partial<ContentOptimizationHandoff> = {},
  ): ContentOptimizationHandoff {
    return {
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      initialPageEvent: 'skip',
      state: createServerOptimizationState(),
      ...overrides,
    }
  }

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

  it('renders baseline by default when optimization is unresolved and no loading fallback is provided', async () => {
    const { optimization } = createRuntime((entry, selectedOptimizations) => {
      if (!selectedOptimizations?.length) return { entry }
      return { entry: variantA, selectedOptimization: selectedOptimizations[0] }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline}>{(resolved) => readTitle(resolved)}</OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('4ib0hsHWoSOnCVdDkizE8d')

    const wrapper = getWrapper(view.container)
    expect(wrapper.dataset.ctflEntryId).toBe('4ib0hsHWoSOnCVdDkizE8d')
    expect(wrapper.dataset.ctflOptimizationId).toBeUndefined()
    expect(wrapper.dataset.ctflVariantIndex).toBe('0')

    await view.unmount()
  })

  it('passes merge-tag helpers to render props', async () => {
    const optimization = createOptimizationSdk()
    const getMergeTagValueCalls: unknown[] = []
    optimization.getMergeTagValue = function (embeddedEntryNodeTarget): string {
      getMergeTagValueCalls.push([this === optimization, embeddedEntryNodeTarget])
      return 'EU'
    }
    const mergeTagEntry = makeMergeTagEntry('merge-tag')

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline}>
        {(_resolved, { getMergeTagValue }) => getMergeTagValue(mergeTagEntry)}
      </OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('EU')
    expect(getMergeTagValueCalls).toContainEqual([true, mergeTagEntry])

    await view.unmount()
  })

  it('locks to first non-undefined optimization state when live updates are disabled', async () => {
    const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
      const selected = selectedOptimizations?.[0]
      const variant = selected ? { 1: variantA, 2: variantB }[selected.variantIndex] : undefined
      if (variant && selected) return { entry: variant, selectedOptimization: selected }
      return { entry }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline}>{(resolved) => readTitle(resolved)}</OptimizedEntry>,
      optimization,
    )

    await emit(variantOneState)
    expect(view.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')

    await emit(variantTwoState)
    expect(view.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')

    await view.unmount()
  })

  it('updates continuously when liveUpdates is true', async () => {
    const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
      const selected = selectedOptimizations?.[0]
      const variant = selected ? { 1: variantA, 2: variantB }[selected.variantIndex] : undefined
      if (variant && selected) return { entry: variant, selectedOptimization: selected }
      return { entry }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline} liveUpdates>
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    await emit(variantOneState)
    expect(view.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')

    await emit(variantTwoState)
    expect(view.container.textContent).toContain('2qVK4T5lnScbswoyBuGipd')

    await view.unmount()
  })

  it('uses loadingFallback while unresolved and removes resolved tracking attrs during loading', async () => {
    const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
      if (!selectedOptimizations?.length) return { entry }
      return { entry: variantA, selectedOptimization: selectedOptimizations[0] }
    })

    const view = await renderComponent(
      <OptimizedEntry
        baselineEntry={optimizedBaseline}
        clickable
        hoverDurationUpdateIntervalMs={1000}
        loadingFallback={() => 'loading'}
      >
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('loading')

    const loadingWrapper = getWrapper(view.container)
    expect(loadingWrapper.dataset.ctflClickable).toBeUndefined()
    expect(loadingWrapper.dataset.ctflEntryId).toBeUndefined()
    expect(loadingWrapper.dataset.ctflHoverDurationUpdateIntervalMs).toBeUndefined()

    await emit(variantOneState)

    expect(view.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')
    const resolvedWrapper = getWrapper(view.container)
    expect(resolvedWrapper.dataset.ctflClickable).toBe('true')
    expect(resolvedWrapper.dataset.ctflBaselineId).toBe('6KfLDCdA75BGwr5HfSeXac')
    expect(resolvedWrapper.dataset.ctflEntryId).toBe('4k6ZyFQnR2POY5IJLLlJRb')
    expect(resolvedWrapper.dataset.ctflHoverDurationUpdateIntervalMs).toBe('1000')

    await view.unmount()
  })

  it('fetches entryId entries and renders the loading fallback until they resolve', async () => {
    const deferred = createDeferred<TestEntry>()
    const { optimization } = createRuntime((entry) => ({ entry }))
    const fetchContentfulEntry = rs.fn(async () => await deferred.promise)
    Reflect.set(optimization, 'fetchContentfulEntry', fetchContentfulEntry)

    const view = await renderComponent(
      <OptimizedEntry
        entryId="4ib0hsHWoSOnCVdDkizE8d"
        entryQuery={{ locale: 'de-DE' }}
        loadingFallback="loading"
      >
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('loading')
    expect(fetchContentfulEntry).toHaveBeenCalledWith('4ib0hsHWoSOnCVdDkizE8d', { locale: 'de-DE' })

    await act(async () => {
      deferred.resolve(baseline)
      await deferred.promise
    })

    expect(view.container.textContent).toContain('4ib0hsHWoSOnCVdDkizE8d')
    expect(getWrapper(view.container).dataset.ctflEntryId).toBe('4ib0hsHWoSOnCVdDkizE8d')

    await view.unmount()
  })

  it('fetches slug entries and keeps resolved metadata on the fetched entry ID', async () => {
    const deferred = createDeferred<TestEntry>()
    const resolvedEntry = makeEntry('resolved-entry-id')
    const onEntryResolved = rs.fn()
    const { optimization } = createRuntime((entry) => ({ entry }))
    const fetchContentfulEntry = rs.fn(async () => await deferred.promise)
    Reflect.set(optimization, 'fetchContentfulEntry', fetchContentfulEntry)
    const managedEntry = { contentType: 'page', slug: 'home' } as const

    const view = await renderComponent(
      <OptimizedEntry
        loadingFallback="loading"
        managedEntry={managedEntry}
        onEntryResolved={onEntryResolved}
      >
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('loading')
    expect(fetchContentfulEntry).toHaveBeenCalledWith(managedEntry)

    await act(async () => {
      deferred.resolve(resolvedEntry)
      await deferred.promise
    })

    expect(view.container.textContent).toContain('resolved-entry-id')
    expect(getWrapper(view.container).dataset.ctflEntryId).toBe('resolved-entry-id')
    expect(onEntryResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        baselineEntryId: 'resolved-entry-id',
        entryId: 'resolved-entry-id',
      }),
    )

    await view.unmount()
  })

  it('renders entryId fetch error fallbacks', async () => {
    const deferred = createDeferred<TestEntry>()
    const error = new Error('CDA failed')
    const onEntryError = rs.fn()
    const { optimization } = createRuntime((entry) => ({ entry }))
    Reflect.set(optimization, 'fetchContentfulEntry', async () => await deferred.promise)

    const view = await renderComponent(
      <OptimizedEntry
        entryId="4ib0hsHWoSOnCVdDkizE8d"
        errorFallback={(entryError) => `error: ${entryError.message}`}
        onEntryError={onEntryError}
      >
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    await act(async () => {
      deferred.reject(error)
      await deferred.promise.catch(() => undefined)
    })

    expect(onEntryError).toHaveBeenCalledWith(error)
    expect(view.container.textContent).toContain('error: CDA failed')

    await view.unmount()
  })

  it('renders slug fetch error fallbacks and invokes onEntryError', async () => {
    const error = new Error('Slug CDA failed')
    const onEntryError = rs.fn()
    const { optimization } = createRuntime((entry) => ({ entry }))
    Reflect.set(optimization, 'fetchContentfulEntry', async () => await Promise.reject(error))

    const view = await renderComponent(
      <OptimizedEntry
        errorFallback={(entryError) => `error: ${entryError.message}`}
        managedEntry={{ contentType: 'page', slug: 'missing' }}
        onEntryError={onEntryError}
      >
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onEntryError).toHaveBeenCalledWith(error)
    expect(view.container.textContent).toContain('error: Slug CDA failed')

    await view.unmount()
  })

  it('reveals baseline after the unresolved loading timeout when a custom fallback is provided', async () => {
    rs.useFakeTimers()

    const { optimization } = createRuntime((entry, selectedOptimizations) => {
      if (!selectedOptimizations?.length) return { entry }
      return { entry: variantA, selectedOptimization: selectedOptimizations[0] }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={optimizedBaseline} loadingFallback={() => 'loading'}>
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('loading')
    expect(view.container.textContent).not.toContain('6KfLDCdA75BGwr5HfSeXac')

    await act(async () => {
      await rs.advanceTimersByTimeAsync(5000)
    })

    expect(view.container.textContent).toContain('6KfLDCdA75BGwr5HfSeXac')
    expect(view.container.textContent).not.toContain('loading')

    const loadingWrapper = getWrapper(view.container)
    expect(loadingWrapper.dataset.ctflEntryId).toBeUndefined()

    await view.unmount()
    rs.useRealTimers()
  })

  it('transitions out of the loading fallback once the experience request fails', async () => {
    const { optimization, setExperienceRequestState } = createRuntime(
      (entry, selectedOptimizations) => {
        if (!selectedOptimizations?.length) return { entry }
        return { entry: variantA, selectedOptimization: selectedOptimizations[0] }
      },
      true,
    )

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={optimizedBaseline} loadingFallback={() => 'loading'}>
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('loading')

    await setExperienceRequestState({ status: 'failed', reason: 'api-error' })

    expect(view.container.textContent).toContain('6KfLDCdA75BGwr5HfSeXac')
    expect(view.container.textContent).not.toContain('loading')

    await view.unmount()
  })

  it('maps data-ctfl-* attributes from resolved optimization metadata', async () => {
    const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
      const selected = selectedOptimizations?.[0]
      if (!selected) return { entry }

      return {
        entry: variantB,
        selectedOptimization: {
          ...selected,
          duplicationScope: 'session',
        },
      }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline}>{(resolved) => readTitle(resolved)}</OptimizedEntry>,
      optimization,
    )

    await emit(variantTwoState)

    const wrapper = getWrapper(view.container)
    expect(wrapper.dataset.ctflBaselineId).toBe('4ib0hsHWoSOnCVdDkizE8d')
    expect(wrapper.dataset.ctflEntryId).toBe('2qVK4T5lnScbswoyBuGipd')
    expect(wrapper.dataset.ctflOptimizationId).toBe('6IueRX1pS3iMJncbhUQTba')
    expect(wrapper.dataset.ctflSticky).toBe('false')
    expect(wrapper.dataset.ctflVariantIndex).toBe('2')
    expect(wrapper.dataset.ctflDuplicationScope).toBe('session')

    await view.unmount()
  })

  it('passes resolved metadata to render props and onEntryResolved', async () => {
    const onEntryResolved = rs.fn()
    const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
      if (!selectedOptimizations?.length) return { entry }
      return {
        entry: variantA,
        optimizationContextId: 'ctx-1',
        selectedOptimization: selectedOptimizations[0],
      }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={optimizedBaseline} onEntryResolved={onEntryResolved}>
        {(resolved, metadata) =>
          `${readTitle(resolved)}:${metadata.baselineEntryId}:${metadata.entryId}:${metadata.optimizationContextId}`
        }
      </OptimizedEntry>,
      optimization,
    )

    await emit(variantOneState)

    expect(view.container.textContent).toContain(
      '4k6ZyFQnR2POY5IJLLlJRb:6KfLDCdA75BGwr5HfSeXac:4k6ZyFQnR2POY5IJLLlJRb:ctx-1',
    )
    expect(onEntryResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        baselineEntry: optimizedBaseline,
        baselineEntryId: '6KfLDCdA75BGwr5HfSeXac',
        entry: variantA,
        entryId: '4k6ZyFQnR2POY5IJLLlJRb',
        optimizationContextId: 'ctx-1',
      }),
    )

    await view.unmount()
  })

  it('keeps preserve-server content visible while onEntryResolved waits for settled state', async () => {
    const onEntryResolved = rs.fn()
    const { optimization, setExperienceRequestState } = createRuntime((entry) => ({ entry }))

    const view = await renderComponent(
      <OptimizationHydrationContext.Provider value="preserve-server">
        <OptimizedEntry baselineEntry={optimizedBaseline} onEntryResolved={onEntryResolved}>
          {(resolved) => readTitle(resolved)}
        </OptimizedEntry>
      </OptimizationHydrationContext.Provider>,
      optimization,
    )

    expect(view.container.textContent).toContain('6KfLDCdA75BGwr5HfSeXac')
    expect(getWrapper(view.container).dataset.ctflEntryId).toBeUndefined()
    expect(onEntryResolved).not.toHaveBeenCalled()

    await setExperienceRequestState({ status: 'success' })

    expect(onEntryResolved).toHaveBeenCalledWith(
      expect.objectContaining({
        baselineEntryId: '6KfLDCdA75BGwr5HfSeXac',
        entryId: '6KfLDCdA75BGwr5HfSeXac',
      }),
    )
    expect(getWrapper(view.container).dataset.ctflEntryId).toBe('6KfLDCdA75BGwr5HfSeXac')

    await view.unmount()
  })

  it('maps configurable Web SDK attributes to data attributes', async () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const view = await renderComponent(
      <OptimizedEntry
        baselineEntry={baseline}
        clickable
        hoverDurationUpdateIntervalMs={1000}
        trackClicks
        trackHovers={false}
        trackViews={false}
        viewDurationUpdateIntervalMs={2000}
      >
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    const wrapper = getWrapper(view.container)
    expect(wrapper.dataset.ctflClickable).toBe('true')
    expect(wrapper.dataset.ctflHoverDurationUpdateIntervalMs).toBe('1000')
    expect(wrapper.dataset.ctflTrackClicks).toBe('true')
    expect(wrapper.dataset.ctflTrackHovers).toBe('false')
    expect(wrapper.dataset.ctflTrackViews).toBe('false')
    expect(wrapper.dataset.ctflViewDurationUpdateIntervalMs).toBe('2000')

    await view.unmount()
  })

  it('does not expose caller overrides for derived metadata attributes', async () => {
    type DerivedMetadataOverrideProps = OptimizedEntryProps & {
      'data-ctfl-baseline-id': string
      'data-ctfl-duplication-scope': string
      'data-ctfl-entry-id': string
      'data-ctfl-optimization-id': string
      'data-ctfl-sticky': string
      'data-ctfl-variant-index': string
    }

    const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
      const selected = selectedOptimizations?.[0]
      if (!selected) return { entry }

      return {
        entry: variantB,
        selectedOptimization: {
          ...selected,
          duplicationScope: 'session',
        },
      }
    })

    const props: DerivedMetadataOverrideProps = {
      baselineEntry: baseline,
      children: (resolved: TestEntry) => readTitle(resolved),
      'data-ctfl-baseline-id': '4ib0hsHWoSOnCVdDkizE8d',
      'data-ctfl-duplication-scope': 'caller-scope',
      'data-ctfl-entry-id': '4k6ZyFQnR2POY5IJLLlJRb',
      'data-ctfl-optimization-id': '6IueRX1pS3iMJncbhUQTba',
      'data-ctfl-sticky': 'true',
      'data-ctfl-variant-index': '99',
    }

    const view = await renderComponent(createElement(OptimizedEntry, props), optimization)

    await emit(variantTwoState)

    const wrapper = getWrapper(view.container)
    expect(wrapper.dataset.ctflBaselineId).toBe('4ib0hsHWoSOnCVdDkizE8d')
    expect(wrapper.dataset.ctflDuplicationScope).toBe('session')
    expect(wrapper.dataset.ctflEntryId).toBe('2qVK4T5lnScbswoyBuGipd')
    expect(wrapper.dataset.ctflOptimizationId).toBe('6IueRX1pS3iMJncbhUQTba')
    expect(wrapper.dataset.ctflSticky).toBe('false')
    expect(wrapper.dataset.ctflVariantIndex).toBe('2')

    await view.unmount()
  })

  it('supports testId/data-testid props with data-testid precedence', async () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline} testId="camel" data-testid="direct">
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    const wrapper = getWrapper(view.container)
    expect(wrapper.dataset.testid).toBe('direct')

    await view.unmount()
  })

  it('supports nested optimization composition', async () => {
    const nestedState: SelectedOptimizationArray = [
      {
        experienceId: 'exp-nested',
        sticky: true,
        variantIndex: 1,
        variants: {
          '3Z2hP4vR8sT1nY6mK9qL0a': '5mN8rY2pL6qT9vW3xA4bCd',
          '7pQ2rS5tU8vW1xY4zA6bCd': '9sT4uV7wX0yZ3aB6cD8eFg',
        },
      },
    ]

    const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
      const selected = selectedOptimizations?.[0]
      if (!selected) return { entry }

      if (entry.sys.id === '3Z2hP4vR8sT1nY6mK9qL0a') {
        return { entry: variantParent, selectedOptimization: selected }
      }

      if (entry.sys.id === '7pQ2rS5tU8vW1xY4zA6bCd') {
        return { entry: variantChild, selectedOptimization: selected }
      }

      return { entry }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baselineParent}>
        {(parentResolved) => (
          <section>
            <h1>{readTitle(parentResolved)}</h1>
            <OptimizedEntry baselineEntry={baselineChild}>
              {(childResolved) => <p>{readTitle(childResolved)}</p>}
            </OptimizedEntry>
          </section>
        )}
      </OptimizedEntry>,
      optimization,
    )

    await emit(nestedState)

    expect(view.container.textContent).toContain('5mN8rY2pL6qT9vW3xA4bCd')
    expect(view.container.textContent).toContain('9sT4uV7wX0yZ3aB6cD8eFg')

    await view.unmount()
  })

  it('preview panel visibility forces live updates even when component liveUpdates is false', async () => {
    const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
      const selected = selectedOptimizations?.[0]
      const variant = selected ? { 1: variantA, 2: variantB }[selected.variantIndex] : undefined
      if (variant && selected) return { entry: variant, selectedOptimization: selected }
      return { entry }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline} liveUpdates={false}>
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
      {
        globalLiveUpdates: false,
        previewPanelVisible: true,
        setPreviewPanelVisible() {
          return undefined
        },
      },
    )

    await emit(variantOneState)
    expect(view.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')

    await emit(variantTwoState)
    expect(view.container.textContent).toContain('2qVK4T5lnScbswoyBuGipd')

    await view.unmount()
  })

  it('renders plain ReactNode children without requiring render-prop usage', async () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline}>
        <article data-testid="static-node">static-child</article>
      </OptimizedEntry>,
      optimization,
    )

    const wrapper = getWrapper(view.container)
    expect(wrapper.tagName).toBe('DIV')
    expect(wrapper.style.display).toBe('contents')

    const staticNode = view.container.querySelector('[data-testid="static-node"]')
    expect(staticNode?.textContent).toBe('static-child')

    await view.unmount()
  })

  it('does not render entry content initially in SPA mode', async () => {
    const { optimization } = createRuntime((entry, selectedOptimizations) => {
      if (!selectedOptimizations?.length) return { entry }
      return { entry: variantA, selectedOptimization: selectedOptimizations[0] }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={optimizedBaseline}>
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('6KfLDCdA75BGwr5HfSeXac')

    const loadingWrapper = getWrapper(view.container)
    expect(loadingWrapper.dataset.ctflEntryId).toBeUndefined()
    const loadingTarget = getRequiredElement(view.container, '[data-ctfl-loading-layout-target]')
    expect(loadingTarget.style.visibility).toBe('hidden')

    await view.unmount()
  })

  it('renders hidden baseline until optimized data arrives in optimized flow', async () => {
    const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
      if (!selectedOptimizations?.length) return { entry }
      return { entry: variantA, selectedOptimization: selectedOptimizations[0] }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={optimizedBaseline}>
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('6KfLDCdA75BGwr5HfSeXac')
    expect(view.container.textContent).not.toContain('4k6ZyFQnR2POY5IJLLlJRb')
    expect(getWrapper(view.container).dataset.ctflEntryId).toBeUndefined()

    await emit(variantOneState)

    expect(view.container.textContent).toContain('4k6ZyFQnR2POY5IJLLlJRb')
    expect(view.container.textContent).not.toContain('6KfLDCdA75BGwr5HfSeXac')

    await view.unmount()
  })

  it('reveals baseline after the unresolved loading timeout without a custom fallback', async () => {
    rs.useFakeTimers()

    const { optimization } = createRuntime((entry, selectedOptimizations) => {
      if (!selectedOptimizations?.length) return { entry }
      return { entry: variantA, selectedOptimization: selectedOptimizations[0] }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={optimizedBaseline}>
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    const loadingTarget = getRequiredElement(view.container, '[data-ctfl-loading-layout-target]')
    expect(loadingTarget.style.visibility).toBe('hidden')

    await act(async () => {
      await rs.advanceTimersByTimeAsync(5000)
    })

    expect(view.container.textContent).toContain('6KfLDCdA75BGwr5HfSeXac')
    expect(loadingTarget.style.visibility).toBe('')
    expect(getWrapper(view.container).dataset.ctflEntryId).toBeUndefined()

    await view.unmount()
  })

  it('prevents nested OptimizedEntry with same baseline entry id', async () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline}>
        {(parentResolved) => (
          <section>
            <h1>{readTitle(parentResolved)}</h1>
            <OptimizedEntry baselineEntry={baseline}>
              {(childResolved) => <p data-testid="nested-same-id">{readTitle(childResolved)}</p>}
            </OptimizedEntry>
          </section>
        )}
      </OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('4ib0hsHWoSOnCVdDkizE8d')
    expect(view.container.querySelector('[data-testid="nested-same-id"]')).toBeNull()

    await view.unmount()
  })

  it('supports consumer wrapper element selection with div default', async () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const defaultView = await renderComponent(
      <OptimizedEntry baselineEntry={baseline}>default-wrapper</OptimizedEntry>,
      optimization,
    )
    const defaultWrapper = getWrapper(defaultView.container)
    expect(defaultWrapper.tagName).toBe('DIV')
    expect(defaultWrapper.style.display).toBe('contents')
    await defaultView.unmount()

    const spanView = await renderComponent(
      <OptimizedEntry baselineEntry={baseline} as="span">
        span-wrapper
      </OptimizedEntry>,
      optimization,
    )
    const spanWrapper = getWrapper(spanView.container)
    expect(spanWrapper.tagName).toBe('SPAN')
    expect(spanWrapper.style.display).toBe('contents')
    await spanView.unmount()
  })

  it('retains loading layout-target behavior when display:contents visibility is unsupported', async () => {
    const { optimization } = createRuntime((entry, selectedOptimizations) => {
      if (!selectedOptimizations?.length) return { entry }
      return { entry: variantA, selectedOptimization: selectedOptimizations[0] }
    })

    const divView = await renderComponent(
      <OptimizedEntry baselineEntry={optimizedBaseline}>
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )
    const divLoadingTarget = getRequiredElement(
      divView.container,
      '[data-ctfl-loading-layout-target]',
    )
    expect(divLoadingTarget.tagName).toBe('DIV')
    expect(divLoadingTarget.style.display).toBe('block')
    await divView.unmount()

    const { optimization: optimization2 } = createRuntime((entry, selectedOptimizations) => {
      if (!selectedOptimizations?.length) return { entry }
      return { entry: variantA, selectedOptimization: selectedOptimizations[0] }
    })

    const spanView = await renderComponent(
      <OptimizedEntry baselineEntry={optimizedBaseline} as="span">
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization2,
    )
    const spanLoadingTarget = getRequiredElement(
      spanView.container,
      '[data-ctfl-loading-layout-target]',
    )
    expect(spanLoadingTarget.tagName).toBe('SPAN')
    expect(spanLoadingTarget.style.display).toBe('inline')
    await spanView.unmount()
  })

  it('renders visible resolved content during SSR when the runtime is ready', () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const markup = renderToStringWithoutWindow(() =>
      renderComponentToString(
        <OptimizedEntry baselineEntry={baseline}>
          {(resolved) => readTitle(resolved)}
        </OptimizedEntry>,
        optimization,
      ),
    )

    expect(markup).toContain('4ib0hsHWoSOnCVdDkizE8d')
    expect(markup).not.toContain('visibility:hidden')
  })

  it('renders managed entryId content from server handoff during SSR', () => {
    const markup = renderToStringWithoutWindow(() =>
      renderToString(
        <OptimizationRoot
          clientId="test-client-id"
          environment="main"
          handoff={createContentHandoff({
            entries: [
              {
                baselineEntry: variantA,
                entryId: '4ib0hsHWoSOnCVdDkizE8d',
                entryQuery: { locale: 'fr-FR' },
              },
              {
                baselineEntry: baseline,
                entryId: '4ib0hsHWoSOnCVdDkizE8d',
                entryQuery: { locale: 'de-DE' },
              },
            ],
          })}
        >
          <OptimizedEntry
            entryId="4ib0hsHWoSOnCVdDkizE8d"
            entryQuery={{ locale: 'de-DE' }}
            loadingFallback="loading"
          >
            {(resolved) => readTitle(resolved)}
          </OptimizedEntry>
        </OptimizationRoot>,
      ),
    )

    expect(markup).toContain('4ib0hsHWoSOnCVdDkizE8d')
    expect(markup).not.toContain('4k6ZyFQnR2POY5IJLLlJRb')
    expect(markup).not.toContain('loading')
  })

  it('renders managed slug content from server handoff during SSR', () => {
    const markup = renderToStringWithoutWindow(() =>
      renderToString(
        <OptimizationRoot
          clientId="test-client-id"
          environment="main"
          handoff={createContentHandoff({
            entries: [
              {
                baselineEntry: baseline,
                entryId: baseline.sys.id,
                managedEntry: { contentType: 'page', slug: 'home', slugField: 'slug' },
              },
            ],
          })}
        >
          <OptimizedEntry
            managedEntry={{ contentType: 'page', slug: 'home', slugField: 'slug' }}
            loadingFallback="loading"
          >
            {(resolved) => readTitle(resolved)}
          </OptimizedEntry>
        </OptimizationRoot>,
      ),
    )

    expect(markup).toContain('4ib0hsHWoSOnCVdDkizE8d')
    expect(markup).not.toContain('loading')
  })

  it('renders non-optimized content after sdk initialization', async () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline}>{(resolved) => readTitle(resolved)}</OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('4ib0hsHWoSOnCVdDkizE8d')

    await view.unmount()
  })

  describe('empty variant', () => {
    const emptyVariantState: SelectedOptimizationArray = [
      {
        experienceId: '6IueRX1pS3iMJncbhUQTba',
        sticky: false,
        variantIndex: 1,
        variants: { '6KfLDCdA75BGwr5HfSeXac': '' },
      },
    ]

    it('renders no content when the resolved variant is empty', async () => {
      const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
        if (selectedOptimizations?.length) {
          return {
            entry,
            isEmptyVariant: true,
            selectedOptimization: selectedOptimizations[0],
          }
        }
        return { entry }
      })

      const view = await renderComponent(
        <OptimizedEntry baselineEntry={optimizedBaseline}>
          {(resolved) => readTitle(resolved)}
        </OptimizedEntry>,
        optimization,
      )

      await emit(emptyVariantState)

      expect(view.container.textContent).toBe('')

      await view.unmount()
    })

    it('keeps the tracking host with data-ctfl-empty-variant when the variant is empty', async () => {
      const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
        if (selectedOptimizations?.length) {
          return {
            entry,
            isEmptyVariant: true,
            selectedOptimization: selectedOptimizations[0],
          }
        }
        return { entry }
      })

      const view = await renderComponent(
        <OptimizedEntry baselineEntry={optimizedBaseline}>
          {(resolved) => readTitle(resolved)}
        </OptimizedEntry>,
        optimization,
      )

      await emit(emptyVariantState)

      const wrapper = getWrapper(view.container)
      expect(wrapper.dataset.ctflEmptyVariant).toBe('true')
      expect(wrapper.dataset.ctflBaselineId).toBe('6KfLDCdA75BGwr5HfSeXac')
      expect(wrapper.dataset.ctflOptimizationId).toBe('6IueRX1pS3iMJncbhUQTba')
      expect(wrapper.dataset.ctflVariantIndex).toBe('1')

      await view.unmount()
    })

    it('does not render baseline content for an empty variant', async () => {
      const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
        if (selectedOptimizations?.length) {
          return {
            entry,
            isEmptyVariant: true,
            selectedOptimization: selectedOptimizations[0],
          }
        }
        return { entry }
      })

      const view = await renderComponent(
        <OptimizedEntry baselineEntry={optimizedBaseline}>
          {(resolved) => readTitle(resolved)}
        </OptimizedEntry>,
        optimization,
      )

      await emit(emptyVariantState)

      expect(view.container.textContent).not.toContain('6KfLDCdA75BGwr5HfSeXac')

      await view.unmount()
    })
  })
})

import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { ManagedEntryDescriptor } from '@contentful/optimization-web/core-sdk'
import {
  getOptimizedEntrySourceKey,
  OptimizedEntryController,
  type OptimizedEntrySnapshot,
} from '@contentful/optimization-web/presentation'
import { act, useLayoutEffect, useRef, useState } from 'react'
import type { LiveUpdatesContextValue } from '../context/LiveUpdatesContext'
import {
  OptimizationContext,
  type OptimizationContextValue,
  type OptimizationSdk,
} from '../context/OptimizationContext'
import { OptimizationHydrationContext } from '../context/OptimizationHydrationContext'
import {
  createOptimizationSdk,
  createRuntime,
  defaultLiveUpdatesContext,
  createTestEntry as makeEntry,
  createOptimizableTestEntry as makeOptimizableEntry,
  renderWithOptimizationProviders,
} from '../test/sdkTestUtils'
import {
  useOptimizedEntry,
  useOptimizedEntrySnapshot,
  type UseOptimizedEntryResult,
} from './useOptimizedEntry'

function createDeferred<T>(): {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
} {
  let resolveDeferred: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve
  })

  return { promise, resolve: resolveDeferred }
}

function getPresentationCandidate(snapshot: OptimizedEntrySnapshot): string {
  return snapshot.loadingPresentation.showLoadingFallback ? 'loading' : snapshot.entry.sys.id
}

async function renderHook(params: {
  baselineEntry: ReturnType<typeof makeEntry>
  liveUpdates?: boolean
  optimization: OptimizationSdk
  liveUpdatesContext?: LiveUpdatesContextValue
  optimizationContext?: Partial<OptimizationContextValue>
}): Promise<{ getResult: () => UseOptimizedEntryResult; unmount: () => Promise<void> }> {
  const {
    baselineEntry,
    liveUpdates,
    optimization,
    liveUpdatesContext = defaultLiveUpdatesContext(),
    optimizationContext,
  } = params
  let captured: UseOptimizedEntryResult | undefined = undefined

  function Probe(): null {
    captured = useOptimizedEntry({ baselineEntry, liveUpdates })
    return null
  }

  const view = await renderWithOptimizationProviders(
    <Probe />,
    optimization,
    liveUpdatesContext,
    optimizationContext,
  )

  return {
    getResult() {
      if (!captured) {
        throw new Error('Expected hook result to be captured')
      }

      return captured
    },
    async unmount() {
      await view.unmount()
    },
  }
}

describe('useOptimizedEntry', () => {
  it('attaches the listener, adopts options, and connects before component layout effects', async () => {
    const baselineEntry = makeOptimizableEntry('4ib0hsHWoSOnCVdDkizE8d')
    const { optimization } = createRuntime((entry) => ({ entry }))
    const setSnapshotListener = rs.spyOn(OptimizedEntryController.prototype, 'setSnapshotListener')
    const updateOptions = rs.spyOn(OptimizedEntryController.prototype, 'updateOptions')
    const connect = rs.spyOn(OptimizedEntryController.prototype, 'connect')
    const disconnect = rs.spyOn(OptimizedEntryController.prototype, 'disconnect')
    const layoutObservations: Array<{
      readonly connected: boolean
      readonly listenerAttached: boolean
      readonly optionsAdopted: boolean
    }> = []

    function Probe(): null {
      useOptimizedEntry({ baselineEntry })
      useLayoutEffect(() => {
        layoutObservations.push({
          connected: connect.mock.calls.length > 0,
          listenerAttached: setSnapshotListener.mock.calls.some(
            ([listener]) => listener !== undefined,
          ),
          optionsAdopted: updateOptions.mock.calls.length > 0,
        })
      }, [])
      return null
    }

    const view = await renderWithOptimizationProviders(<Probe />, optimization)

    expect(layoutObservations).toEqual([
      { connected: true, listenerAttached: true, optionsAdopted: true },
    ])

    await view.unmount()

    expect(setSnapshotListener).toHaveBeenLastCalledWith(undefined)
    expect(disconnect).toHaveBeenCalledTimes(1)
    setSnapshotListener.mockRestore()
    updateOptions.mockRestore()
    connect.mockRestore()
    disconnect.mockRestore()
  })

  it('presents loading before an unseeded optimized baseline can become visible', async () => {
    const baselineEntry = makeOptimizableEntry('4ib0hsHWoSOnCVdDkizE8d')
    const { optimization } = createRuntime((entry) => ({ entry }))
    const renderCandidates: string[] = []

    function Probe(): React.JSX.Element {
      const snapshot = useOptimizedEntrySnapshot({ baselineEntry })
      const candidate = getPresentationCandidate(snapshot)
      renderCandidates.push(candidate)

      return <span>{candidate}</span>
    }

    const view = await renderWithOptimizationProviders(<Probe />, optimization)

    expect(renderCandidates[0]).toBe('loading')
    expect(renderCandidates.every((candidate) => candidate === 'loading')).toBe(true)
    expect(view.container.textContent).toBe('loading')

    await view.unmount()
  })

  it('keeps preserve-server content visible through snapshot-to-live adoption', async () => {
    const baselineEntry = makeOptimizableEntry('4ib0hsHWoSOnCVdDkizE8d')
    const { optimization } = createRuntime((entry) => ({ entry }))
    const renderCandidates: string[] = []
    let adoptLiveSdk: (() => void) | undefined = undefined

    function Probe(): React.JSX.Element {
      const snapshot = useOptimizedEntrySnapshot({ baselineEntry })
      const candidate = getPresentationCandidate(snapshot)
      renderCandidates.push(candidate)

      return <span>{candidate}</span>
    }

    function AdoptionHarness(): React.JSX.Element {
      const [liveSdk, setLiveSdk] = useState<OptimizationSdk | undefined>(undefined)
      adoptLiveSdk = () => {
        setLiveSdk(optimization)
      }

      return (
        <OptimizationContext.Provider
          value={{ error: undefined, isLive: liveSdk !== undefined, sdk: liveSdk }}
        >
          <OptimizationHydrationContext.Provider value="preserve-server">
            <Probe />
          </OptimizationHydrationContext.Provider>
        </OptimizationContext.Provider>
      )
    }

    const view = await renderWithOptimizationProviders(<AdoptionHarness />, optimization)

    await act(async () => {
      adoptLiveSdk?.()
      await Promise.resolve()
    })

    expect(renderCandidates.length).toBeGreaterThan(1)
    expect(renderCandidates.every((candidate) => candidate === baselineEntry.sys.id)).toBe(true)
    expect(view.container.textContent).toBe(baselineEntry.sys.id)

    await view.unmount()
  })

  it('does not restore loading after a selected presentation commits', async () => {
    const baselineEntry = makeOptimizableEntry('4ib0hsHWoSOnCVdDkizE8d')
    const variantEntry = makeEntry('4k6ZyFQnR2POY5IJLLlJRb')
    const variantState: SelectedOptimizationArray = [
      {
        experienceId: '6IueRX1pS3iMJncbhUQTba',
        sticky: true,
        variantIndex: 1,
        variants: { '4ib0hsHWoSOnCVdDkizE8d': '4k6ZyFQnR2POY5IJLLlJRb' },
      },
    ]
    const { emit, optimization, setExperienceRequestState } = createRuntime(
      (entry, selectedOptimizations) => ({
        entry: selectedOptimizations ? variantEntry : entry,
        selectedOptimization: selectedOptimizations?.[0],
      }),
    )
    const candidates: string[] = []

    function Probe(): React.JSX.Element {
      const snapshot = useOptimizedEntrySnapshot({ baselineEntry })
      const candidate = getPresentationCandidate(snapshot)
      candidates.push(candidate)
      return <span>{candidate}</span>
    }

    const view = await renderWithOptimizationProviders(<Probe />, optimization)
    await emit(variantState)
    const committedCandidateIndex = candidates.lastIndexOf(variantEntry.sys.id)

    await setExperienceRequestState({ status: 'pending' })
    await setExperienceRequestState({ status: 'failed', reason: 'api-error' })

    expect(committedCandidateIndex).toBeGreaterThan(-1)
    expect(candidates.slice(committedCandidateIndex)).not.toContain('loading')
    expect(view.container.textContent).toBe(variantEntry.sys.id)

    await view.unmount()
  })

  it('opens a loading presentation before paint when the baseline ID changes', async () => {
    const firstEntry = makeEntry('4ib0hsHWoSOnCVdDkizE8d')
    const secondEntry = makeOptimizableEntry('3Z2hP4vR8sT1nY6mK9qL0a')
    const { optimization } = createRuntime((entry) => ({ entry }))
    const secondEntryRenderCandidates: string[] = []
    const secondEntryPrePaintCandidates: string[] = []
    let setBaselineEntry: ((entry: typeof firstEntry) => void) | undefined = undefined

    function Probe(): React.JSX.Element {
      const [baselineEntry, setEntry] = useState(firstEntry)
      const presentationRef = useRef<HTMLSpanElement>(null)
      setBaselineEntry = setEntry
      const snapshot = useOptimizedEntrySnapshot({ baselineEntry })
      const candidate = getPresentationCandidate(snapshot)

      if (baselineEntry === secondEntry) {
        secondEntryRenderCandidates.push(candidate)
      }
      useLayoutEffect(() => {
        if (baselineEntry === secondEntry) {
          queueMicrotask(() => {
            secondEntryPrePaintCandidates.push(
              presentationRef.current?.textContent ?? 'missing-presentation',
            )
          })
        }
      }, [baselineEntry, candidate])

      return <span ref={presentationRef}>{candidate}</span>
    }

    const view = await renderWithOptimizationProviders(<Probe />, optimization)

    await act(async () => {
      setBaselineEntry?.(secondEntry)
      await Promise.resolve()
    })

    expect(secondEntryRenderCandidates).toContain('loading')
    expect(secondEntryPrePaintCandidates.length).toBeGreaterThan(0)
    expect(secondEntryPrePaintCandidates.every((candidate) => candidate === 'loading')).toBe(true)
    expect(view.container.textContent).toBe('loading')

    await view.unmount()
  })

  it('does not publish controller state after cleanup', async () => {
    const baselineEntry = makeOptimizableEntry('4ib0hsHWoSOnCVdDkizE8d')
    const variantEntry = makeEntry('4k6ZyFQnR2POY5IJLLlJRb')
    const variantState: SelectedOptimizationArray = [
      {
        experienceId: '6IueRX1pS3iMJncbhUQTba',
        sticky: true,
        variantIndex: 1,
        variants: { '4ib0hsHWoSOnCVdDkizE8d': '4k6ZyFQnR2POY5IJLLlJRb' },
      },
    ]
    const resolveOptimizedEntry = rs.fn((entry, selectedOptimizations) => ({
      entry: selectedOptimizations ? variantEntry : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const { emit, optimization } = createRuntime(resolveOptimizedEntry)

    function Probe(): null {
      useOptimizedEntrySnapshot({ baselineEntry })
      return null
    }

    const view = await renderWithOptimizationProviders(<Probe />, optimization)
    await view.unmount()
    const resolutionCountAfterCleanup = resolveOptimizedEntry.mock.calls.length

    await emit(variantState)

    expect(resolveOptimizedEntry).toHaveBeenCalledTimes(resolutionCountAfterCleanup)
  })

  it('returns baseline state before optimization is available', async () => {
    const baselineEntry = makeOptimizableEntry('4ib0hsHWoSOnCVdDkizE8d')
    const { optimization } = createRuntime((entry) => ({ entry }))
    const rendered = await renderHook({ baselineEntry, optimization })

    expect(rendered.getResult()).toMatchObject({
      entry: baselineEntry,
      selectedOptimization: undefined,
      isLoading: true,
      isPresentationReady: true,
      canOptimize: false,
      selectedOptimizations: undefined,
    })
    expect(rendered.getResult()).not.toHaveProperty('isReady')

    await rendered.unmount()
  })

  it('returns resolved variant data once selectedOptimizations are available', async () => {
    const baselineEntry = makeOptimizableEntry('4ib0hsHWoSOnCVdDkizE8d')
    const variantEntry = makeEntry('4k6ZyFQnR2POY5IJLLlJRb')
    const variantState: SelectedOptimizationArray = [
      {
        experienceId: '6IueRX1pS3iMJncbhUQTba',
        sticky: true,
        variantIndex: 1,
        variants: { '4ib0hsHWoSOnCVdDkizE8d': '4k6ZyFQnR2POY5IJLLlJRb' },
      },
    ]
    const { emit, optimization } = createRuntime((entry, selectedOptimizations) => ({
      entry: selectedOptimizations ? variantEntry : entry,
      optimizationContextId: selectedOptimizations ? 'ctx-1' : undefined,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const rendered = await renderHook({ baselineEntry, optimization })

    await emit(variantState)

    expect(rendered.getResult()).toMatchObject({
      entry: variantEntry,
      selectedOptimization: variantState[0],
      isLoading: false,
      isResolved: true,
      metadata: {
        baselineEntry,
        baselineEntryId: '4ib0hsHWoSOnCVdDkizE8d',
        entry: variantEntry,
        entryId: '4k6ZyFQnR2POY5IJLLlJRb',
        optimizationContextId: 'ctx-1',
        selectedOptimization: variantState[0],
        selectedOptimizations: variantState,
      },
      canOptimize: true,
      selectedOptimizations: variantState,
    })

    await rendered.unmount()
  })

  it('locks on the first optimization when live updates are disabled', async () => {
    const baselineEntry = makeOptimizableEntry('4ib0hsHWoSOnCVdDkizE8d')
    const variantOne = makeEntry('4k6ZyFQnR2POY5IJLLlJRb')
    const variantTwo = makeEntry('2qVK4T5lnScbswoyBuGipd')
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
    const { emit, optimization } = createRuntime((entry, selectedOptimizations) => ({
      entry:
        selectedOptimizations?.[0]?.variantIndex === 1
          ? variantOne
          : selectedOptimizations?.[0]?.variantIndex === 2
            ? variantTwo
            : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const rendered = await renderHook({ baselineEntry, optimization })

    await emit(variantOneState)
    expect(rendered.getResult().entry).toEqual(variantOne)

    await emit(variantTwoState)
    expect(rendered.getResult().entry).toEqual(variantOne)
    expect(rendered.getResult().selectedOptimizations).toEqual(variantOneState)

    await rendered.unmount()
  })

  it('follows optimization changes when live updates are enabled', async () => {
    const baselineEntry = makeOptimizableEntry('4ib0hsHWoSOnCVdDkizE8d')
    const variantOne = makeEntry('4k6ZyFQnR2POY5IJLLlJRb')
    const variantTwo = makeEntry('2qVK4T5lnScbswoyBuGipd')
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
    const { emit, optimization } = createRuntime((entry, selectedOptimizations) => ({
      entry:
        selectedOptimizations?.[0]?.variantIndex === 1
          ? variantOne
          : selectedOptimizations?.[0]?.variantIndex === 2
            ? variantTwo
            : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const rendered = await renderHook({ baselineEntry, optimization, liveUpdates: true })

    await emit(variantOneState)
    expect(rendered.getResult().entry).toEqual(variantOne)

    await emit(variantTwoState)
    expect(rendered.getResult().entry).toEqual(variantTwo)
    expect(rendered.getResult().selectedOptimizations).toEqual(variantTwoState)

    await rendered.unmount()
  })

  it('treats non-optimized entries as ready immediately', async () => {
    const baselineEntry = makeEntry('4ib0hsHWoSOnCVdDkizE8d')
    const { optimization } = createRuntime((entry) => ({ entry }))
    const rendered = await renderHook({ baselineEntry, optimization })

    expect(rendered.getResult()).toMatchObject({
      entry: baselineEntry,
      isLoading: false,
      isPresentationReady: true,
      canOptimize: false,
      selectedOptimization: undefined,
      selectedOptimizations: undefined,
    })

    await rendered.unmount()
  })

  it('returns updated baselineEntry props during the first render after manual entry changes', async () => {
    const firstEntry = makeEntry('4ib0hsHWoSOnCVdDkizE8d')
    const secondEntry = makeEntry('3Z2hP4vR8sT1nY6mK9qL0a')
    const optimization = createOptimizationSdk()
    const renderedEntryIdsAfterUpdate: string[] = []
    let setBaselineEntry: ((entry: typeof firstEntry) => void) | undefined

    function Probe(): null {
      const [baselineEntry, setEntry] = useState(firstEntry)
      setBaselineEntry = setEntry
      const result = useOptimizedEntry({ baselineEntry })
      if (baselineEntry === secondEntry) {
        renderedEntryIdsAfterUpdate.push(result.baselineEntry.sys.id)
      }
      return null
    }

    const view = await renderWithOptimizationProviders(<Probe />, optimization)

    await act(async () => {
      setBaselineEntry?.(secondEntry)
      await Promise.resolve()
    })

    expect(renderedEntryIdsAfterUpdate[0]).toBe('3Z2hP4vR8sT1nY6mK9qL0a')

    await view.unmount()
  })

  it('fetches entryId entries through the SDK', async () => {
    const baselineEntry = makeEntry('4ib0hsHWoSOnCVdDkizE8d')
    const fetchContentfulEntry = rs.fn(async () => await Promise.resolve(baselineEntry))
    const optimization = createOptimizationSdk({
      fetchContentfulEntry,
    })
    let captured: UseOptimizedEntryResult | undefined = undefined

    function Probe(): null {
      captured = useOptimizedEntry({
        entryId: '4ib0hsHWoSOnCVdDkizE8d',
        entryQuery: { locale: 'de-DE' },
      })
      return null
    }

    function getCaptured(): UseOptimizedEntryResult {
      if (!captured) throw new Error('Expected hook result to be captured')
      return captured
    }

    const view = await renderWithOptimizationProviders(<Probe />, optimization)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchContentfulEntry).toHaveBeenCalledWith('4ib0hsHWoSOnCVdDkizE8d', { locale: 'de-DE' })
    expect(getCaptured().entry).toBe(baselineEntry)
    expect(getCaptured().baselineEntry).toBe(baselineEntry)
    expect(getCaptured().error).toBeUndefined()

    await view.unmount()
  })

  it('forwards managed entry descriptors', async () => {
    const resolvedEntry = makeEntry('resolved-entry-id')
    const fetchContentfulEntry = rs.fn(async () => await Promise.resolve(resolvedEntry))
    const optimization = createOptimizationSdk()
    Reflect.set(optimization, 'fetchContentfulEntry', fetchContentfulEntry)

    function Probe({
      managedEntry,
    }: {
      readonly managedEntry: Exclude<ManagedEntryDescriptor, string>
    }): null {
      useOptimizedEntry({ managedEntry })
      return null
    }

    const defaultDescriptor = {
      contentType: 'page',
      slug: 'home',
      entryQuery: { locale: 'de-DE' },
    } as const
    const view = await renderWithOptimizationProviders(
      <Probe managedEntry={defaultDescriptor} />,
      optimization,
    )
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchContentfulEntry).toHaveBeenLastCalledWith(defaultDescriptor)

    const customDescriptor = { ...defaultDescriptor, slugField: 'path' } as const
    await view.rerender(<Probe managedEntry={customDescriptor} />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchContentfulEntry).toHaveBeenLastCalledWith(customDescriptor)

    await view.unmount()
  })

  it('ignores stale slug results after the source changes', async () => {
    const firstFetch = createDeferred<ReturnType<typeof makeEntry>>()
    const secondFetch = createDeferred<ReturnType<typeof makeEntry>>()
    const firstEntry = makeEntry('first-entry-id')
    const secondEntry = makeEntry('second-entry-id')
    const optimization = createOptimizationSdk()
    Reflect.set(
      optimization,
      'fetchContentfulEntry',
      rs.fn(
        async (descriptor: { readonly slug: string }) =>
          await (descriptor.slug === 'first' ? firstFetch.promise : secondFetch.promise),
      ),
    )
    let setSlug: ((slug: string) => void) | undefined = undefined
    let captured: UseOptimizedEntryResult | undefined = undefined

    function Probe(): null {
      const [slug, setCurrentSlug] = useState('first')
      setSlug = setCurrentSlug
      captured = useOptimizedEntry({ managedEntry: { contentType: 'page', slug } })
      return null
    }

    const getCaptured = (): UseOptimizedEntryResult => {
      if (!captured) throw new Error('Expected hook result to be captured')
      return captured
    }

    const view = await renderWithOptimizationProviders(<Probe />, optimization)

    await act(async () => {
      setSlug?.('second')
      await Promise.resolve()
      secondFetch.resolve(secondEntry)
      await secondFetch.promise
    })
    expect(getCaptured().entry).toBe(secondEntry)

    await act(async () => {
      firstFetch.resolve(firstEntry)
      await firstFetch.promise
    })
    expect(getCaptured().entry).toBe(secondEntry)

    await view.unmount()
  })

  it('does not fetch entryId entries while the context is snapshot-backed', async () => {
    const fetchContentfulEntry = rs.fn(
      async () => await Promise.resolve(makeEntry('4ib0hsHWoSOnCVdDkizE8d')),
    )
    const optimization = createOptimizationSdk({ fetchContentfulEntry })
    let captured: UseOptimizedEntryResult | undefined = undefined

    function Probe(): null {
      captured = useOptimizedEntry({ entryId: '4ib0hsHWoSOnCVdDkizE8d' })
      return null
    }

    function getCaptured(): UseOptimizedEntryResult {
      if (!captured) throw new Error('Expected hook result to be captured')
      return captured
    }

    const view = await renderWithOptimizationProviders(
      <Probe />,
      optimization,
      defaultLiveUpdatesContext(),
      { isLive: false },
    )
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchContentfulEntry).not.toHaveBeenCalled()
    expect(getCaptured()).toMatchObject({
      entry: undefined,
      isLoading: true,
    })

    await view.unmount()
  })

  it('uses server handoff entries before fetching new live entry IDs', async () => {
    const preloadedEntry = makeEntry('5mN8rY2pL6qT9vW3xA4bCd')
    const liveEntry = makeEntry('7pQ2rS5tU8vW1xY4zA6bCd')
    const fetchContentfulEntry = rs.fn(async () => await Promise.resolve(liveEntry))
    const optimization = createOptimizationSdk({ fetchContentfulEntry })
    let setEntryId: ((entryId: string) => void) | undefined = undefined
    let captured: UseOptimizedEntryResult | undefined = undefined

    function Probe(): null {
      const [entryId, setCurrentEntryId] = useState('4ib0hsHWoSOnCVdDkizE8d')
      setEntryId = setCurrentEntryId
      captured = useOptimizedEntry({
        entryId,
        entryQuery: { locale: 'de-DE' },
      })
      return null
    }

    function getCaptured(): UseOptimizedEntryResult {
      if (!captured) throw new Error('Expected hook result to be captured')
      return captured
    }

    const view = await renderWithOptimizationProviders(
      <Probe />,
      optimization,
      defaultLiveUpdatesContext(),
      {
        isLive: true,
        prefetchedManagedEntries: new Map([
          [
            getOptimizedEntrySourceKey('4ib0hsHWoSOnCVdDkizE8d', { locale: 'de-DE' }),
            preloadedEntry,
          ],
        ]),
      },
    )

    expect(getCaptured().entry).toBe(preloadedEntry)
    expect(fetchContentfulEntry).not.toHaveBeenCalled()

    await act(async () => {
      setEntryId?.('3Z2hP4vR8sT1nY6mK9qL0a')
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchContentfulEntry).toHaveBeenCalledWith('3Z2hP4vR8sT1nY6mK9qL0a', { locale: 'de-DE' })
    expect(getCaptured().entry).toBe(liveEntry)

    await view.unmount()
  })

  it('surfaces entryId fetch errors', async () => {
    const error = new Error('CDA failed')
    const onEntryError = rs.fn()
    const optimization = createOptimizationSdk({
      fetchContentfulEntry: async () => await Promise.reject(error),
    })
    let captured: UseOptimizedEntryResult | undefined = undefined

    function Probe(): null {
      captured = useOptimizedEntry({ entryId: '4ib0hsHWoSOnCVdDkizE8d', onEntryError })
      return null
    }

    function getCaptured(): UseOptimizedEntryResult {
      if (!captured) throw new Error('Expected hook result to be captured')
      return captured
    }

    const view = await renderWithOptimizationProviders(<Probe />, optimization)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onEntryError).toHaveBeenCalledWith(error)
    expect(getCaptured().entry).toBeUndefined()
    expect(getCaptured().error).toBe(error)
    expect(getCaptured().isLoading).toBe(false)

    await view.unmount()
  })
})

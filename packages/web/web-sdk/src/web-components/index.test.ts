import type {
  ExperienceRequestState,
  Observable,
  ResolvedData,
} from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import type { Entry, EntrySkeletonType } from 'contentful'
import ContentfulOptimization from '../ContentfulOptimization'
import type { OptimizationRootSdk } from '../presentation'
import { ContentfulOptimizationRootElement } from './ContentfulOptimizationRootElement'
import {
  ContentfulOptimizedEntryElement,
  type ContentfulOptimizedEntryEventDetail,
} from './ContentfulOptimizedEntryElement'
import { defineContentfulOptimizationElements } from './index'

type Subscriber<T> = (value: T) => void

interface TestObservable<T> extends Observable<T> {
  emit: (value: T) => void
  subscriberCount: () => number
}

type WebRuntimeStates = ContentfulOptimization['states']

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
    subscribe(next: Subscriber<T>) {
      subscribers.add(next)
      next(currentValue)

      return {
        unsubscribe() {
          subscribers.delete(next)
        },
      }
    },
    subscribeOnce(next: (value: NonNullable<T>) => void) {
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

async function resolveAccepted(): Promise<{ accepted: true }> {
  await Promise.resolve()
  return { accepted: true }
}

async function resolveVoid(): Promise<void> {
  await Promise.resolve()
}

function toContentfulOptimization<TSdk extends object>(sdk: TSdk): TSdk & ContentfulOptimization {
  Object.setPrototypeOf(sdk, ContentfulOptimization.prototype)

  if (!(sdk instanceof ContentfulOptimization)) {
    throw new Error('Expected SDK test double to use the ContentfulOptimization prototype.')
  }

  return sdk
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
  options: {
    readonly previewPanelOpen?: boolean
  } = {},
): {
  readonly canOptimize: TestObservable<boolean>
  readonly destroy: ReturnType<typeof rs.fn>
  readonly experienceRequestState: TestObservable<ExperienceRequestState>
  readonly previewPanelOpen: TestObservable<boolean>
  readonly sdk: ContentfulOptimization
  readonly selectedOptimizations: TestObservable<SelectedOptimizationArray | undefined>
} {
  const selectedOptimizations = createObservable<SelectedOptimizationArray | undefined>(undefined)
  const canOptimize = createObservable(false)
  const experienceRequestState = createObservable<ExperienceRequestState>({ status: 'idle' })
  const previewPanelOpen = createObservable(options.previewPanelOpen ?? false)
  const destroy = rs.fn()
  const states = {
    blockedEventStream:
      createObservable<WebRuntimeStates['blockedEventStream']['current']>(undefined),
    canOptimize,
    consent: createObservable<WebRuntimeStates['consent']['current']>(undefined),
    eventStream: createObservable<WebRuntimeStates['eventStream']['current']>(undefined),
    experienceRequestState,
    flag: () => createObservable<ReturnType<WebRuntimeStates['flag']>['current']>(undefined),
    locale: createObservable<WebRuntimeStates['locale']['current']>(undefined),
    optimizationPossible:
      createObservable<WebRuntimeStates['optimizationPossible']['current']>(true),
    persistenceConsent:
      createObservable<WebRuntimeStates['persistenceConsent']['current']>(undefined),
    previewPanelAttached:
      createObservable<WebRuntimeStates['previewPanelAttached']['current']>(false),
    previewPanelOpen,
    profile: createObservable<WebRuntimeStates['profile']['current']>(undefined),
    selectedOptimizations,
  } satisfies WebRuntimeStates

  const sdk = {
    consent: () => undefined,
    destroy,
    flush: resolveVoid,
    getFlag: () => undefined,
    getMergeTagValue: () => undefined,
    hasConsent: () => true,
    identify: resolveAccepted,
    locale: undefined,
    page: resolveAccepted,
    reset: () => undefined,
    resolveOptimizedEntry,
    screen: resolveAccepted,
    setLocale: () => undefined,
    states,
    track: resolveAccepted,
    trackClick: resolveVoid,
    trackFlagView: resolveVoid,
    trackHover: resolveVoid,
    tracking: {
      clearElement: () => undefined,
      disable: () => undefined,
      disableElement: () => undefined,
      enable: () => undefined,
      enableElement: () => undefined,
    },
    trackCurrentPage: resolveAccepted,
    trackView: resolveAccepted,
  } satisfies OptimizationRootSdk

  return {
    canOptimize,
    destroy,
    experienceRequestState,
    previewPanelOpen,
    sdk: toContentfulOptimization(sdk),
    selectedOptimizations,
  }
}

function createRootElement(sdk: ContentfulOptimization): ContentfulOptimizationRootElement {
  const root = document.createElement('ctfl-optimization-root')

  if (!(root instanceof ContentfulOptimizationRootElement)) {
    throw new Error('ctfl-optimization-root is not registered.')
  }

  root.sdk = sdk

  return root
}

function createEntryElement(baselineEntry: Entry): ContentfulOptimizedEntryElement {
  const entry = document.createElement('ctfl-optimized-entry')

  if (!(entry instanceof ContentfulOptimizedEntryElement)) {
    throw new Error('ctfl-optimized-entry is not registered.')
  }

  entry.baselineEntry = baselineEntry

  return entry
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isEntryDetail(value: unknown): value is ContentfulOptimizedEntryEventDetail {
  return isRecord(value) && 'entry' in value && 'resolvedData' in value && 'snapshot' in value
}

function getEntryDetail(event: Event): ContentfulOptimizedEntryEventDetail {
  if (!(event instanceof CustomEvent)) {
    throw new Error('Expected a custom event.')
  }

  const { detail }: { detail: unknown } = event
  if (!isEntryDetail(detail)) {
    throw new Error('Expected Contentful optimized entry event detail.')
  }

  return detail
}

function ensureElementsDefined(): void {
  defineContentfulOptimizationElements()
}

describe('Contentful Optimization Web Components', () => {
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
    document.body.innerHTML = ''
    rs.restoreAllMocks()
  })

  it('does not register custom elements as an import side effect', () => {
    expect(customElements.get('ctfl-optimization-root')).toBeUndefined()
    expect(customElements.get('ctfl-optimized-entry')).toBeUndefined()
  })

  it('registers custom elements on demand with duplicate guards', () => {
    ensureElementsDefined()

    expect(customElements.get('ctfl-optimization-root')).toBe(ContentfulOptimizationRootElement)
    expect(customElements.get('ctfl-optimized-entry')).toBe(ContentfulOptimizedEntryElement)
    expect(() => {
      defineContentfulOptimizationElements()
    }).not.toThrow()
  })

  it('auto-binds entries under custom registered element tags', () => {
    const rootTagName = 'ctfl-test-optimization-root'
    const optimizedEntryTagName = 'ctfl-test-optimized-entry'
    defineContentfulOptimizationElements({ optimizedEntryTagName, rootTagName })
    const runtime = createSdk((entry) => ({ entry }))
    const root = document.createElement(rootTagName)
    const entry = document.createElement(optimizedEntryTagName)

    if (!(root instanceof ContentfulOptimizationRootElement)) {
      throw new Error('Expected custom root tag to be registered.')
    }

    if (!(entry instanceof ContentfulOptimizedEntryElement)) {
      throw new Error('Expected custom optimized entry tag to be registered.')
    }

    root.sdk = runtime.sdk
    entry.baselineEntry = baseline
    root.append(entry)
    document.body.append(root)

    expect(entry.dataset.ctflEntryId).toBe('baseline')
  })

  it('binds injected root SDKs without destroying them on disconnect', () => {
    ensureElementsDefined()
    const runtime = createSdk((entry) => ({ entry }))
    const root = createRootElement(runtime.sdk)
    const ready = rs.fn()

    root.addEventListener('ctfl-root-ready', ready)
    document.body.append(root)

    expect(ready).toHaveBeenCalledTimes(1)
    expect(root.style.display).toBe('contents')

    root.remove()

    expect(runtime.destroy).not.toHaveBeenCalled()
  })

  it('resolves entries through the nearest root and applies host attributes', () => {
    ensureElementsDefined()
    const runtime = createSdk((entry) => ({ entry }))
    const root = createRootElement(runtime.sdk)
    const entry = createEntryElement(baseline)
    const resolved = rs.fn((event: Event) => getEntryDetail(event).entry.sys.id)

    entry.addEventListener('ctfl-entry-resolved', resolved)
    root.append(entry)
    document.body.append(root)

    expect(resolved).toHaveReturnedWith('baseline')
    expect(entry.style.display).toBe('contents')
    expect(entry.dataset.ctflEntryId).toBe('baseline')
    expect(entry.dataset.ctflVariantIndex).toBe('0')
  })

  it('dispatches loading and resolved events while keeping loading host attributes empty', () => {
    ensureElementsDefined()
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations ? variantA : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const root = createRootElement(runtime.sdk)
    const entry = createEntryElement(optimizedBaseline)
    const loading = rs.fn()
    const resolved = rs.fn((event: Event) => getEntryDetail(event).entry.sys.id)

    entry.addEventListener('ctfl-entry-loading', loading)
    entry.addEventListener('ctfl-entry-resolved', resolved)
    root.append(entry)
    document.body.append(root)

    expect(loading).toHaveBeenCalledTimes(1)
    expect(entry.dataset.ctflBaselineId).toBeUndefined()
    expect(entry.dataset.ctflEntryId).toBeUndefined()
    expect(entry.style.visibility).toBe('hidden')

    runtime.selectedOptimizations.emit(variantOneState)
    runtime.canOptimize.emit(true)
    runtime.experienceRequestState.emit({ status: 'success' })

    expect(resolved).toHaveReturnedWith('variant-a')
    expect(entry.dataset.ctflBaselineId).toBe('optimized-baseline')
    expect(entry.dataset.ctflEntryId).toBe('variant-a')
    expect(entry.dataset.ctflOptimizationId).toBe('exp-hero')
    expect(entry.dataset.ctflVariantIndex).toBe('1')
    expect(entry.style.visibility).toBe('')
  })

  it('clears presentation state when baselineEntry is unset and resolves again when reused', () => {
    ensureElementsDefined()
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry: selectedOptimizations ? variantA : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const root = createRootElement(runtime.sdk)
    const entry = createEntryElement(optimizedBaseline)
    const resolved = rs.fn((event: Event) => getEntryDetail(event).entry.sys.id)

    entry.addEventListener('ctfl-entry-resolved', resolved)
    root.append(entry)
    document.body.append(root)

    runtime.selectedOptimizations.emit(variantOneState)
    runtime.canOptimize.emit(true)
    runtime.experienceRequestState.emit({ status: 'success' })

    expect(resolved).toHaveReturnedWith('variant-a')
    expect(entry.dataset.ctflEntryId).toBe('variant-a')
    expect(entry.dataset.ctflBaselineId).toBe('optimized-baseline')
    expect(entry.dataset.ctflOptimizationId).toBe('exp-hero')
    expect(entry.dataset.ctflSticky).toBe('true')
    expect(entry.dataset.ctflVariantIndex).toBe('1')

    resolved.mockClear()
    entry.baselineEntry = undefined

    expect(entry.dataset.ctflEntryId).toBeUndefined()
    expect(entry.dataset.ctflBaselineId).toBeUndefined()
    expect(entry.dataset.ctflOptimizationId).toBeUndefined()
    expect(entry.dataset.ctflSticky).toBeUndefined()
    expect(entry.dataset.ctflVariantIndex).toBeUndefined()
    expect(entry.style.visibility).toBe('')

    entry.baselineEntry = optimizedBaseline

    expect(resolved).toHaveReturnedWith('variant-a')
  })

  it('clears loading presentation when the SDK context becomes unavailable', () => {
    ensureElementsDefined()
    const runtime = createSdk((entry) => ({ entry }))
    const entry = createEntryElement(optimizedBaseline)

    document.body.append(entry)
    entry.sdk = runtime.sdk

    expect(entry.style.visibility).toBe('hidden')

    entry.sdk = undefined

    expect(entry.style.visibility).toBe('')
    expect(entry.dataset.ctflEntryId).toBeUndefined()
  })

  it('locks selected optimizations until root live updates are enabled', () => {
    ensureElementsDefined()
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry:
        selectedOptimizations?.[0]?.variantIndex === 1
          ? variantA
          : selectedOptimizations?.[0]?.variantIndex === 2
            ? variantB
            : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const root = createRootElement(runtime.sdk)
    const entry = createEntryElement(baseline)
    const resolved = rs.fn((event: Event) => getEntryDetail(event).entry.sys.id)

    entry.addEventListener('ctfl-entry-resolved', resolved)
    root.append(entry)
    document.body.append(root)

    runtime.selectedOptimizations.emit(variantOneState)
    expect(entry.dataset.ctflEntryId).toBe('variant-a')

    runtime.selectedOptimizations.emit(variantTwoState)
    expect(entry.dataset.ctflEntryId).toBe('variant-a')

    root.liveUpdates = true

    expect(entry.dataset.ctflEntryId).toBe('variant-b')
    expect(resolved).toHaveReturnedWith('variant-b')
  })

  it('preserves initial preview panel state so entries follow live updates', () => {
    ensureElementsDefined()
    const runtime = createSdk(
      (entry, selectedOptimizations) => ({
        entry:
          selectedOptimizations?.[0]?.variantIndex === 1
            ? variantA
            : selectedOptimizations?.[0]?.variantIndex === 2
              ? variantB
              : entry,
        selectedOptimization: selectedOptimizations?.[0],
      }),
      { previewPanelOpen: true },
    )
    const root = createRootElement(runtime.sdk)
    const entry = createEntryElement(baseline)

    root.append(entry)
    document.body.append(root)

    runtime.selectedOptimizations.emit(variantOneState)
    expect(entry.dataset.ctflEntryId).toBe('variant-a')

    runtime.selectedOptimizations.emit(variantTwoState)
    expect(entry.dataset.ctflEntryId).toBe('variant-b')
  })

  it('applies only changed host attributes', () => {
    ensureElementsDefined()
    const runtime = createSdk((entry, selectedOptimizations) => ({
      entry:
        selectedOptimizations?.[0]?.variantIndex === 1
          ? variantA
          : selectedOptimizations?.[0]?.variantIndex === 2
            ? variantB
            : entry,
      selectedOptimization: selectedOptimizations?.[0],
    }))
    const root = createRootElement(runtime.sdk)
    const entry = createEntryElement(baseline)

    entry.liveUpdates = true
    root.append(entry)
    document.body.append(root)

    runtime.selectedOptimizations.emit(variantOneState)

    const setAttribute = rs.spyOn(entry, 'setAttribute')

    runtime.selectedOptimizations.emit(variantTwoState)

    expect(setAttribute).toHaveBeenCalledWith('data-ctfl-entry-id', 'variant-b')
    expect(setAttribute).toHaveBeenCalledWith('data-ctfl-sticky', 'false')
    expect(setAttribute).toHaveBeenCalledWith('data-ctfl-variant-index', '2')
    expect(setAttribute).not.toHaveBeenCalledWith('data-ctfl-optimization-id', 'exp-hero')
  })

  it('bubbles resolved entry events for delegated listeners', () => {
    ensureElementsDefined()
    const runtime = createSdk((entry) => ({ entry }))
    const root = createRootElement(runtime.sdk)
    const entry = createEntryElement(baseline)
    const delegated = rs.fn((event: Event) => event.target)

    root.addEventListener('ctfl-entry-resolved', delegated)
    root.append(entry)
    document.body.append(root)

    expect(delegated).toHaveReturnedWith(entry)
  })

  it('cleans up entry subscriptions on disconnect', () => {
    ensureElementsDefined()
    const runtime = createSdk((entry) => ({ entry }))
    const root = createRootElement(runtime.sdk)
    const entry = createEntryElement(baseline)

    root.append(entry)
    document.body.append(root)

    expect(runtime.selectedOptimizations.subscriberCount()).toBe(1)

    entry.remove()

    expect(runtime.selectedOptimizations.subscriberCount()).toBe(0)
  })

  it('keeps unregistered SSR-style markup inert', () => {
    const inert = document.createElement('ctfl-unregistered-optimized-entry')
    inert.textContent = 'static baseline'

    expect(inert.textContent).toBe('static baseline')
  })
})

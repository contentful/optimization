import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { LiveUpdatesContextValue } from '../context/LiveUpdatesContext'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import { OptimizationContext } from '../context/OptimizationContext'
import { Personalization } from './Personalization'

type TestEntry = Entry
type SelectedPersonalizationState = SelectedPersonalizationArray | undefined
type PersonalizeEntry = (
  entry: TestEntry,
  selectedPersonalizations: SelectedPersonalizationState,
) => ResolvedData<EntrySkeletonType>
type SelectedPersonalizationsSubscriber = (value: SelectedPersonalizationState) => void
type CanPersonalizeSubscriber = (value: boolean) => void

interface RuntimeOptimization {
  personalizeEntry: PersonalizeEntry
  states: {
    canPersonalize: {
      subscribe: (next: CanPersonalizeSubscriber) => { unsubscribe: () => void }
    }
    selectedPersonalizations: {
      subscribe: (next: SelectedPersonalizationsSubscriber) => { unsubscribe: () => void }
    }
  }
}

function makeEntry(id: string): TestEntry {
  const entry: TestEntry = {
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

  return entry
}

function createRuntime(personalizeEntry: PersonalizeEntry): {
  emit: (value: SelectedPersonalizationState) => Promise<void>
  contentfulOptimization: RuntimeOptimization
} {
  const subscribers = new Set<SelectedPersonalizationsSubscriber>()
  const canPersonalizeSubscribers = new Set<CanPersonalizeSubscriber>()
  let current: SelectedPersonalizationState = undefined
  let canPersonalize = false

  const contentfulOptimization: RuntimeOptimization = {
    personalizeEntry,
    states: {
      canPersonalize: {
        subscribe(next: CanPersonalizeSubscriber) {
          canPersonalizeSubscribers.add(next)
          next(canPersonalize)

          return {
            unsubscribe() {
              canPersonalizeSubscribers.delete(next)
            },
          }
        },
      },
      selectedPersonalizations: {
        subscribe(next: SelectedPersonalizationsSubscriber) {
          subscribers.add(next)
          next(current)

          return {
            unsubscribe() {
              subscribers.delete(next)
            },
          }
        },
      },
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

  return { emit, contentfulOptimization }
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

async function renderComponent(
  node: ReactNode,
  contentfulOptimization: RuntimeOptimization,
  liveUpdatesContext = defaultLiveUpdatesContext(),
): Promise<{ container: HTMLDivElement; unmount: () => Promise<void> }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    await Promise.resolve()
    root.render(
      // @ts-expect-error test double only implements the subset used by Personalization
      <OptimizationContext.Provider value={{ instance: contentfulOptimization }}>
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

function getWrapper(container: HTMLElement): HTMLElement {
  const { firstElementChild: wrapper } = container

  if (!(wrapper instanceof HTMLElement)) {
    throw new TypeError('Expected first child to be an HTMLElement')
  }

  return wrapper
}

function readTitle(entry: TestEntry): string {
  const {
    fields: { title },
  } = entry
  return typeof title === 'string' ? title : ''
}

describe('Personalization', () => {
  const baseline = makeEntry('baseline')
  const variantA = makeEntry('variant-a')
  const variantB = makeEntry('variant-b')

  const baselineParent = makeEntry('parent-baseline')
  const variantParent = makeEntry('parent-variant')
  const baselineChild = makeEntry('child-baseline')
  const variantChild = makeEntry('child-variant')

  const variantOneState: SelectedPersonalizationArray = [
    {
      experienceId: 'exp-hero',
      sticky: true,
      variantIndex: 1,
      variants: {
        baseline: 'variant-a',
      },
    },
  ]

  const variantTwoState: SelectedPersonalizationArray = [
    {
      experienceId: 'exp-hero',
      sticky: false,
      variantIndex: 2,
      variants: {
        baseline: 'variant-b',
      },
    },
  ]

  void afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders baseline by default when personalization is unresolved and no loading fallback is provided', async () => {
    const { contentfulOptimization } = createRuntime((entry, personalizations) => {
      if (!personalizations?.length) return { entry }
      return { entry: variantA, personalization: personalizations[0] }
    })

    const view = await renderComponent(
      <Personalization baselineEntry={baseline}>
        {(resolved) => readTitle(resolved)}
      </Personalization>,
      contentfulOptimization,
    )

    expect(view.container.textContent).toContain('baseline')

    const wrapper = getWrapper(view.container)
    expect(wrapper.dataset.ctflEntryId).toBe('baseline')
    expect(wrapper.dataset.ctflPersonalizationId).toBeUndefined()
    expect(wrapper.dataset.ctflVariantIndex).toBe('0')

    await view.unmount()
  })

  it('locks to first non-undefined personalization state when live updates are disabled', async () => {
    const { contentfulOptimization, emit } = createRuntime((entry, selectedPersonalizations) => {
      const selected = selectedPersonalizations?.[0]
      const variant = selected ? { 1: variantA, 2: variantB }[selected.variantIndex] : undefined
      if (variant && selected) return { entry: variant, personalization: selected }
      return { entry }
    })

    const view = await renderComponent(
      <Personalization baselineEntry={baseline}>
        {(resolved) => readTitle(resolved)}
      </Personalization>,
      contentfulOptimization,
    )

    await emit(variantOneState)
    expect(view.container.textContent).toContain('variant-a')

    await emit(variantTwoState)
    expect(view.container.textContent).toContain('variant-a')

    await view.unmount()
  })

  it('updates continuously when liveUpdates is true', async () => {
    const { contentfulOptimization, emit } = createRuntime((entry, selectedPersonalizations) => {
      const selected = selectedPersonalizations?.[0]
      const variant = selected ? { 1: variantA, 2: variantB }[selected.variantIndex] : undefined
      if (variant && selected) return { entry: variant, personalization: selected }
      return { entry }
    })

    const view = await renderComponent(
      <Personalization baselineEntry={baseline} liveUpdates>
        {(resolved) => readTitle(resolved)}
      </Personalization>,
      contentfulOptimization,
    )

    await emit(variantOneState)
    expect(view.container.textContent).toContain('variant-a')

    await emit(variantTwoState)
    expect(view.container.textContent).toContain('variant-b')

    await view.unmount()
  })

  it('uses loadingFallback while unresolved and removes resolved tracking attrs during loading', async () => {
    const { contentfulOptimization, emit } = createRuntime((entry, selectedPersonalizations) => {
      if (!selectedPersonalizations?.length) return { entry }
      return { entry: variantA, personalization: selectedPersonalizations[0] }
    })

    const view = await renderComponent(
      <Personalization baselineEntry={baseline} loadingFallback={() => 'loading'}>
        {(resolved) => readTitle(resolved)}
      </Personalization>,
      contentfulOptimization,
    )

    expect(view.container.textContent).toContain('loading')

    const loadingWrapper = getWrapper(view.container)
    expect(loadingWrapper.dataset.ctflEntryId).toBeUndefined()

    await emit(variantOneState)

    expect(view.container.textContent).toContain('variant-a')
    const resolvedWrapper = getWrapper(view.container)
    expect(resolvedWrapper.dataset.ctflEntryId).toBe('variant-a')

    await view.unmount()
  })

  it('maps data-ctfl-* attributes from resolved personalization metadata', async () => {
    const { contentfulOptimization, emit } = createRuntime((entry, selectedPersonalizations) => {
      const selected = selectedPersonalizations?.[0]
      if (!selected) return { entry }

      return {
        entry: variantB,
        personalization: {
          ...selected,
          duplicationScope: 'session',
        },
      }
    })

    const view = await renderComponent(
      <Personalization baselineEntry={baseline}>
        {(resolved) => readTitle(resolved)}
      </Personalization>,
      contentfulOptimization,
    )

    await emit(variantTwoState)

    const wrapper = getWrapper(view.container)
    expect(wrapper.dataset.ctflEntryId).toBe('variant-b')
    expect(wrapper.dataset.ctflPersonalizationId).toBe('exp-hero')
    expect(wrapper.dataset.ctflSticky).toBe('false')
    expect(wrapper.dataset.ctflVariantIndex).toBe('2')
    expect(wrapper.dataset.ctflDuplicationScope).toBe('session')

    await view.unmount()
  })

  it('supports testId/data-testid props with data-testid precedence', async () => {
    const { contentfulOptimization } = createRuntime((entry) => ({ entry }))

    const view = await renderComponent(
      <Personalization baselineEntry={baseline} testId="camel" data-testid="direct">
        {(resolved) => readTitle(resolved)}
      </Personalization>,
      contentfulOptimization,
    )

    const wrapper = getWrapper(view.container)
    expect(wrapper.dataset.testid).toBe('direct')

    await view.unmount()
  })

  it('supports nested personalization composition', async () => {
    const nestedState: SelectedPersonalizationArray = [
      {
        experienceId: 'exp-nested',
        sticky: true,
        variantIndex: 1,
        variants: {
          'parent-baseline': 'parent-variant',
          'child-baseline': 'child-variant',
        },
      },
    ]

    const { contentfulOptimization, emit } = createRuntime((entry, selectedPersonalizations) => {
      const selected = selectedPersonalizations?.[0]
      if (!selected) return { entry }

      if (entry.sys.id === 'parent-baseline') {
        return { entry: variantParent, personalization: selected }
      }

      if (entry.sys.id === 'child-baseline') {
        return { entry: variantChild, personalization: selected }
      }

      return { entry }
    })

    const view = await renderComponent(
      <Personalization baselineEntry={baselineParent}>
        {(parentResolved) => (
          <section>
            <h1>{readTitle(parentResolved)}</h1>
            <Personalization baselineEntry={baselineChild}>
              {(childResolved) => <p>{readTitle(childResolved)}</p>}
            </Personalization>
          </section>
        )}
      </Personalization>,
      contentfulOptimization,
    )

    await emit(nestedState)

    expect(view.container.textContent).toContain('parent-variant')
    expect(view.container.textContent).toContain('child-variant')

    await view.unmount()
  })

  it('preview panel visibility forces live updates even when component liveUpdates is false', async () => {
    const { contentfulOptimization, emit } = createRuntime((entry, selectedPersonalizations) => {
      const selected = selectedPersonalizations?.[0]
      const variant = selected ? { 1: variantA, 2: variantB }[selected.variantIndex] : undefined
      if (variant && selected) return { entry: variant, personalization: selected }
      return { entry }
    })

    const view = await renderComponent(
      <Personalization baselineEntry={baseline} liveUpdates={false}>
        {(resolved) => readTitle(resolved)}
      </Personalization>,
      contentfulOptimization,
      {
        globalLiveUpdates: false,
        previewPanelVisible: true,
        setPreviewPanelVisible() {
          return undefined
        },
      },
    )

    await emit(variantOneState)
    expect(view.container.textContent).toContain('variant-a')

    await emit(variantTwoState)
    expect(view.container.textContent).toContain('variant-b')

    await view.unmount()
  })
})

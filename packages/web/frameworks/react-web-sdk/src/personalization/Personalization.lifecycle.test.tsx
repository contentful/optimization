import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { LiveUpdatesContextValue } from '../context/LiveUpdatesContext'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import { OptimizationContext } from '../context/OptimizationContext'
import { Personalization } from './Personalization'

type TestEntry = Entry
type PersonalizationState = SelectedPersonalizationArray | undefined
type PersonalizeEntry = (
  entry: TestEntry,
  personalizations: PersonalizationState,
) => ResolvedData<EntrySkeletonType>
type PersonalizationsSubscriber = (value: PersonalizationState) => void
type CanPersonalizeSubscriber = (value: boolean) => void

interface RuntimeOptimization {
  personalizeEntry: PersonalizeEntry
  states: {
    canPersonalize: {
      subscribe: (next: CanPersonalizeSubscriber) => { unsubscribe: () => void }
    }
    personalizations: {
      subscribe: (next: PersonalizationsSubscriber) => { unsubscribe: () => void }
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

function makePersonalizableEntry(id: string): TestEntry {
  const entry = makeEntry(id)
  entry.fields = {
    ...entry.fields,
    nt_experiences: [{ sys: { id: 'exp-1' } }],
  }
  return entry
}

function createRuntime(personalizeEntry: PersonalizeEntry): {
  emit: (value: PersonalizationState) => Promise<void>
  optimization: RuntimeOptimization
} {
  const subscribers = new Set<PersonalizationsSubscriber>()
  const canPersonalizeSubscribers = new Set<CanPersonalizeSubscriber>()
  let current: PersonalizationState = undefined
  let canPersonalize = false

  const optimization: RuntimeOptimization = {
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
      personalizations: {
        subscribe(next: PersonalizationsSubscriber) {
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
  optimization: RuntimeOptimization,
  liveUpdatesContext = defaultLiveUpdatesContext(),
): Promise<{ container: HTMLDivElement; unmount: () => Promise<void> }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    await Promise.resolve()
    root.render(
      // @ts-expect-error test double only implements the subset used by Personalization
      <OptimizationContext.Provider value={{ instance: optimization }}>
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

function renderComponentToString(
  node: ReactNode,
  optimization: RuntimeOptimization,
  liveUpdatesContext = defaultLiveUpdatesContext(),
): string {
  return renderToString(
    // @ts-expect-error test double only implements the subset used by Personalization
    <OptimizationContext.Provider value={{ instance: optimization }}>
      <LiveUpdatesContext.Provider value={liveUpdatesContext}>{node}</LiveUpdatesContext.Provider>
    </OptimizationContext.Provider>,
  )
}

function renderToStringWithoutWindow(render: () => string): string {
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

function getWrapper(container: HTMLElement): HTMLElement {
  const { firstElementChild: wrapper } = container

  if (!(wrapper instanceof HTMLElement)) {
    throw new TypeError('Expected first child to be an HTMLElement')
  }

  return wrapper
}

function getRequiredElement(container: HTMLElement, selector: string): HTMLElement {
  const target = container.querySelector(selector)

  if (!(target instanceof HTMLElement)) {
    throw new TypeError(`Expected selector "${selector}" to resolve to an HTMLElement`)
  }

  return target
}

function readTitle(entry: TestEntry): string {
  const {
    fields: { title },
  } = entry
  return typeof title === 'string' ? title : ''
}

describe('Personalization lifecycle and nesting guard', () => {
  const baseline = makeEntry('baseline')
  const personalizedBaseline = makePersonalizableEntry('personalized-baseline')
  const variantA = makeEntry('variant-a')

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

  void afterEach(() => {
    document.body.innerHTML = ''
    rs.restoreAllMocks()
  })

  it('renders plain ReactNode children without requiring render-prop usage', async () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const view = await renderComponent(
      <Personalization baselineEntry={baseline}>
        <article data-testid="static-node">static-child</article>
      </Personalization>,
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
    const { optimization } = createRuntime((entry, personalizations) => {
      if (!personalizations?.length) return { entry }
      return { entry: variantA, personalization: personalizations[0] }
    })

    const view = await renderComponent(
      <Personalization baselineEntry={personalizedBaseline}>
        {(resolved) => readTitle(resolved)}
      </Personalization>,
      optimization,
    )

    expect(view.container.textContent).toContain('Loading...')
    expect(view.container.textContent).not.toContain('personalized-baseline')

    const loadingWrapper = getWrapper(view.container)
    expect(loadingWrapper.dataset.ctflEntryId).toBeUndefined()

    await view.unmount()
  })

  it('renders loading until canPersonalize is true for personalized flow', async () => {
    const { optimization, emit } = createRuntime((entry, personalizations) => {
      if (!personalizations?.length) return { entry }
      return { entry: variantA, personalization: personalizations[0] }
    })

    const view = await renderComponent(
      <Personalization baselineEntry={personalizedBaseline}>
        {(resolved) => readTitle(resolved)}
      </Personalization>,
      optimization,
    )

    expect(view.container.textContent).toContain('Loading...')
    expect(view.container.textContent).not.toContain('variant-a')

    await emit(variantOneState)

    expect(view.container.textContent).toContain('variant-a')
    expect(view.container.textContent).not.toContain('Loading...')

    await view.unmount()
  })

  it('prevents nested Personalization with same baseline entry id', async () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const view = await renderComponent(
      <Personalization baselineEntry={baseline}>
        {(parentResolved) => (
          <section>
            <h1>{readTitle(parentResolved)}</h1>
            <Personalization baselineEntry={baseline}>
              {(childResolved) => <p data-testid="nested-same-id">{readTitle(childResolved)}</p>}
            </Personalization>
          </section>
        )}
      </Personalization>,
      optimization,
    )

    expect(view.container.textContent).toContain('baseline')
    expect(view.container.querySelector('[data-testid="nested-same-id"]')).toBeNull()

    await view.unmount()
  })

  it('supports consumer wrapper element selection with div default', async () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const defaultView = await renderComponent(
      <Personalization baselineEntry={baseline}>default-wrapper</Personalization>,
      optimization,
    )
    const defaultWrapper = getWrapper(defaultView.container)
    expect(defaultWrapper.tagName).toBe('DIV')
    expect(defaultWrapper.style.display).toBe('contents')
    await defaultView.unmount()

    const spanView = await renderComponent(
      <Personalization baselineEntry={baseline} as="span">
        span-wrapper
      </Personalization>,
      optimization,
    )
    const spanWrapper = getWrapper(spanView.container)
    expect(spanWrapper.tagName).toBe('SPAN')
    expect(spanWrapper.style.display).toBe('contents')
    await spanView.unmount()
  })

  it('retains loading layout-target behavior when display:contents visibility is unsupported', async () => {
    const { optimization } = createRuntime((entry, personalizations) => {
      if (!personalizations?.length) return { entry }
      return { entry: variantA, personalization: personalizations[0] }
    })

    const divView = await renderComponent(
      <Personalization baselineEntry={personalizedBaseline}>
        {(resolved) => readTitle(resolved)}
      </Personalization>,
      optimization,
    )
    const divLoadingTarget = getRequiredElement(
      divView.container,
      '[data-ctfl-loading-layout-target]',
    )
    expect(divLoadingTarget.tagName).toBe('DIV')
    expect(divLoadingTarget.style.display).toBe('block')
    await divView.unmount()

    const spanView = await renderComponent(
      <Personalization baselineEntry={personalizedBaseline} as="span">
        {(resolved) => readTitle(resolved)}
      </Personalization>,
      optimization,
    )
    const spanLoadingTarget = getRequiredElement(
      spanView.container,
      '[data-ctfl-loading-layout-target]',
    )
    expect(spanLoadingTarget.tagName).toBe('SPAN')
    expect(spanLoadingTarget.style.display).toBe('inline')
    await spanView.unmount()
  })

  it('renders invisible loading target during SSR for non-personalized entries', () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const markup = renderToStringWithoutWindow(() =>
      renderComponentToString(
        <Personalization baselineEntry={baseline}>
          {(resolved) => readTitle(resolved)}
        </Personalization>,
        optimization,
      ),
    )

    expect(markup).toContain('data-ctfl-loading-layout-target="true"')
    expect(markup).toContain('visibility:hidden')
    expect(markup).toContain('Loading...')
    expect(markup).not.toContain('baseline')
  })

  it('renders non-personalized content after sdk initialization', async () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const view = await renderComponent(
      <Personalization baselineEntry={baseline}>
        {(resolved) => readTitle(resolved)}
      </Personalization>,
      optimization,
    )

    expect(view.container.textContent).toContain('baseline')
    expect(view.container.textContent).not.toContain('Loading...')

    await view.unmount()
  })
})

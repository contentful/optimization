import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import { OptimizedEntry } from './OptimizedEntry'
import {
  createRuntime,
  getRequiredElement,
  getWrapper,
  makeEntry,
  makePersonalizableEntry,
  readTitle,
  renderComponent,
  renderComponentToString,
  renderToStringWithoutWindow,
} from './OptimizedEntry.testUtils'

describe('OptimizedEntry', () => {
  const baseline = makeEntry('baseline')
  const personalizedBaseline = makePersonalizableEntry('personalized-baseline')
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

  it('renders baseline by default when personalization is unresolved and no loading fallback is provided', async () => {
    const { optimization } = createRuntime((entry, personalizations) => {
      if (!personalizations?.length) return { entry }
      return { entry: variantA, personalization: personalizations[0] }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline}>{(resolved) => readTitle(resolved)}</OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('baseline')

    const wrapper = getWrapper(view.container)
    expect(wrapper.dataset.ctflEntryId).toBe('baseline')
    expect(wrapper.dataset.ctflPersonalizationId).toBeUndefined()
    expect(wrapper.dataset.ctflVariantIndex).toBe('0')

    await view.unmount()
  })

  it('locks to first non-undefined personalization state when live updates are disabled', async () => {
    const { optimization, emit } = createRuntime((entry, selectedPersonalizations) => {
      const selected = selectedPersonalizations?.[0]
      const variant = selected ? { 1: variantA, 2: variantB }[selected.variantIndex] : undefined
      if (variant && selected) return { entry: variant, personalization: selected }
      return { entry }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline}>{(resolved) => readTitle(resolved)}</OptimizedEntry>,
      optimization,
    )

    await emit(variantOneState)
    expect(view.container.textContent).toContain('variant-a')

    await emit(variantTwoState)
    expect(view.container.textContent).toContain('variant-a')

    await view.unmount()
  })

  it('updates continuously when liveUpdates is true', async () => {
    const { optimization, emit } = createRuntime((entry, selectedPersonalizations) => {
      const selected = selectedPersonalizations?.[0]
      const variant = selected ? { 1: variantA, 2: variantB }[selected.variantIndex] : undefined
      if (variant && selected) return { entry: variant, personalization: selected }
      return { entry }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline} liveUpdates>
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    await emit(variantOneState)
    expect(view.container.textContent).toContain('variant-a')

    await emit(variantTwoState)
    expect(view.container.textContent).toContain('variant-b')

    await view.unmount()
  })

  it('uses loadingFallback while unresolved and removes resolved tracking attrs during loading', async () => {
    const { optimization, emit } = createRuntime((entry, selectedPersonalizations) => {
      if (!selectedPersonalizations?.length) return { entry }
      return { entry: variantA, personalization: selectedPersonalizations[0] }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={personalizedBaseline} loadingFallback={() => 'loading'}>
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
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
    const { optimization, emit } = createRuntime((entry, selectedPersonalizations) => {
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
      <OptimizedEntry baselineEntry={baseline}>{(resolved) => readTitle(resolved)}</OptimizedEntry>,
      optimization,
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

    const { optimization, emit } = createRuntime((entry, selectedPersonalizations) => {
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

    expect(view.container.textContent).toContain('parent-variant')
    expect(view.container.textContent).toContain('child-variant')

    await view.unmount()
  })

  it('preview panel visibility forces live updates even when component liveUpdates is false', async () => {
    const { optimization, emit } = createRuntime((entry, selectedPersonalizations) => {
      const selected = selectedPersonalizations?.[0]
      const variant = selected ? { 1: variantA, 2: variantB }[selected.variantIndex] : undefined
      if (variant && selected) return { entry: variant, personalization: selected }
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
    expect(view.container.textContent).toContain('variant-a')

    await emit(variantTwoState)
    expect(view.container.textContent).toContain('variant-b')

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
    const { optimization } = createRuntime((entry, personalizations) => {
      if (!personalizations?.length) return { entry }
      return { entry: variantA, personalization: personalizations[0] }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={personalizedBaseline}>
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('personalized-baseline')

    const loadingWrapper = getWrapper(view.container)
    expect(loadingWrapper.dataset.ctflEntryId).toBeUndefined()
    const loadingTarget = getRequiredElement(view.container, '[data-ctfl-loading-layout-target]')
    expect(loadingTarget.style.visibility).toBe('hidden')

    await view.unmount()
  })

  it('renders loading until canPersonalize is true for personalized flow', async () => {
    const { optimization, emit } = createRuntime((entry, personalizations) => {
      if (!personalizations?.length) return { entry }
      return { entry: variantA, personalization: personalizations[0] }
    })

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={personalizedBaseline}>
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('personalized-baseline')
    expect(view.container.textContent).not.toContain('variant-a')

    await emit(variantOneState)

    expect(view.container.textContent).toContain('variant-a')
    expect(view.container.textContent).not.toContain('personalized-baseline')

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

    expect(view.container.textContent).toContain('baseline')
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
    const { optimization } = createRuntime((entry, personalizations) => {
      if (!personalizations?.length) return { entry }
      return { entry: variantA, personalization: personalizations[0] }
    })

    const divView = await renderComponent(
      <OptimizedEntry baselineEntry={personalizedBaseline}>
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

    const spanView = await renderComponent(
      <OptimizedEntry baselineEntry={personalizedBaseline} as="span">
        {(resolved) => readTitle(resolved)}
      </OptimizedEntry>,
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
        <OptimizedEntry baselineEntry={baseline}>
          {(resolved) => readTitle(resolved)}
        </OptimizedEntry>,
        optimization,
      ),
    )

    expect(markup).toContain('data-ctfl-loading-layout-target="true"')
    expect(markup).toContain('visibility:hidden')
    expect(markup).toContain('baseline')
  })

  it('renders non-personalized content after sdk initialization', async () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline}>{(resolved) => readTitle(resolved)}</OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('baseline')

    await view.unmount()
  })
})

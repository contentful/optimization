import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { act, createElement } from 'react'
import { OptimizedEntry, type OptimizedEntryProps } from './OptimizedEntry'
import {
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

describe('OptimizedEntry', () => {
  const baseline = makeEntry('baseline')
  const optimizedBaseline = makeOptimizableEntry('optimized-baseline')
  const variantA = makeEntry('variant-a')
  const variantB = makeEntry('variant-b')

  const baselineParent = makeEntry('parent-baseline')
  const variantParent = makeEntry('parent-variant')
  const baselineChild = makeEntry('child-baseline')
  const variantChild = makeEntry('child-variant')

  const variantOneState: SelectedOptimizationArray = [
    {
      experienceId: 'exp-hero',
      sticky: true,
      variantIndex: 1,
      variants: {
        baseline: 'variant-a',
      },
    },
  ]

  const variantTwoState: SelectedOptimizationArray = [
    {
      experienceId: 'exp-hero',
      sticky: false,
      variantIndex: 2,
      variants: {
        baseline: 'variant-b',
      },
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

    expect(view.container.textContent).toContain('baseline')

    const wrapper = getWrapper(view.container)
    expect(wrapper.dataset.ctflEntryId).toBe('baseline')
    expect(wrapper.dataset.ctflOptimizationId).toBeUndefined()
    expect(wrapper.dataset.ctflVariantIndex).toBe('0')

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
    expect(view.container.textContent).toContain('variant-a')

    await emit(variantTwoState)
    expect(view.container.textContent).toContain('variant-a')

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
    expect(view.container.textContent).toContain('variant-a')

    await emit(variantTwoState)
    expect(view.container.textContent).toContain('variant-b')

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

    expect(view.container.textContent).toContain('variant-a')
    const resolvedWrapper = getWrapper(view.container)
    expect(resolvedWrapper.dataset.ctflClickable).toBe('true')
    expect(resolvedWrapper.dataset.ctflBaselineId).toBe('optimized-baseline')
    expect(resolvedWrapper.dataset.ctflEntryId).toBe('variant-a')
    expect(resolvedWrapper.dataset.ctflHoverDurationUpdateIntervalMs).toBe('1000')

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
    expect(view.container.textContent).not.toContain('optimized-baseline')

    await act(async () => {
      await rs.advanceTimersByTimeAsync(5000)
    })

    expect(view.container.textContent).toContain('optimized-baseline')
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

    expect(view.container.textContent).toContain('optimized-baseline')
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
    expect(wrapper.dataset.ctflBaselineId).toBe('baseline')
    expect(wrapper.dataset.ctflEntryId).toBe('variant-b')
    expect(wrapper.dataset.ctflOptimizationId).toBe('exp-hero')
    expect(wrapper.dataset.ctflSticky).toBe('false')
    expect(wrapper.dataset.ctflVariantIndex).toBe('2')
    expect(wrapper.dataset.ctflDuplicationScope).toBe('session')

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
      'data-ctfl-baseline-id': 'caller-baseline',
      'data-ctfl-duplication-scope': 'caller-scope',
      'data-ctfl-entry-id': 'caller-entry',
      'data-ctfl-optimization-id': 'caller-exp',
      'data-ctfl-sticky': 'true',
      'data-ctfl-variant-index': '99',
    }

    const view = await renderComponent(createElement(OptimizedEntry, props), optimization)

    await emit(variantTwoState)

    const wrapper = getWrapper(view.container)
    expect(wrapper.dataset.ctflBaselineId).toBe('baseline')
    expect(wrapper.dataset.ctflDuplicationScope).toBe('session')
    expect(wrapper.dataset.ctflEntryId).toBe('variant-b')
    expect(wrapper.dataset.ctflOptimizationId).toBe('exp-hero')
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
          'parent-baseline': 'parent-variant',
          'child-baseline': 'child-variant',
        },
      },
    ]

    const { optimization, emit } = createRuntime((entry, selectedOptimizations) => {
      const selected = selectedOptimizations?.[0]
      if (!selected) return { entry }

      if (entry.sys.id === 'parent-baseline') {
        return { entry: variantParent, selectedOptimization: selected }
      }

      if (entry.sys.id === 'child-baseline') {
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

    expect(view.container.textContent).toContain('parent-variant')
    expect(view.container.textContent).toContain('child-variant')

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

    expect(view.container.textContent).toContain('optimized-baseline')

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

    expect(view.container.textContent).toContain('optimized-baseline')
    expect(view.container.textContent).not.toContain('variant-a')
    expect(getWrapper(view.container).dataset.ctflEntryId).toBeUndefined()

    await emit(variantOneState)

    expect(view.container.textContent).toContain('variant-a')
    expect(view.container.textContent).not.toContain('optimized-baseline')

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

    expect(view.container.textContent).toContain('optimized-baseline')
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

  it('renders invisible loading target during SSR for non-optimized entries', () => {
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

  it('renders non-optimized content after sdk initialization', async () => {
    const { optimization } = createRuntime((entry) => ({ entry }))

    const view = await renderComponent(
      <OptimizedEntry baselineEntry={baseline}>{(resolved) => readTitle(resolved)}</OptimizedEntry>,
      optimization,
    )

    expect(view.container.textContent).toContain('baseline')

    await view.unmount()
  })
})

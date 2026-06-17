import { expect, test, type Locator, type Page } from '@playwright/test'

const MANUAL_VIEW_ENTRY_SELECTOR = '[data-testid="manual-view-entry"]'

interface HostSnapshot {
  readonly baselineId: string | null
  readonly entryId: string | null
  readonly optimizationId: string | null
  readonly sticky: string | null
  readonly variantIndex: string | null
  readonly visibility: string
}

async function waitForReferenceEntry(page: Page): Promise<Locator> {
  const entry = page.locator(MANUAL_VIEW_ENTRY_SELECTOR)

  await expect(entry).toHaveAttribute('data-ctfl-entry-id', /.+/)
  await page.waitForFunction((selector) => {
    const element = document.querySelector(selector)

    return (
      element instanceof HTMLElement &&
      'baselineEntry' in element &&
      element.baselineEntry !== undefined
    )
  }, MANUAL_VIEW_ENTRY_SELECTOR)

  return entry
}

test.describe('web component lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
    await waitForReferenceEntry(page)
  })

  test('clears host presentation state when baselineEntry is unset and resolves again', async ({
    page,
  }) => {
    const resetResult = await page.locator(MANUAL_VIEW_ENTRY_SELECTOR).evaluate(async (node) => {
      interface OptimizedEntryElement extends HTMLElement {
        baselineEntry?: unknown
        sdk?: unknown
      }

      interface ObservableValue<T> {
        readonly current: T
        readonly subscribe: (next: (value: T) => void) => { unsubscribe: () => void }
        readonly subscribeOnce: (next: (value: NonNullable<T>) => void) => {
          unsubscribe: () => void
        }
      }

      function isOptimizedEntryElement(value: unknown): value is OptimizedEntryElement {
        return value instanceof HTMLElement && 'baselineEntry' in value
      }

      function isResolvedEntryDetail(
        value: unknown,
      ): value is { readonly entry: { readonly sys: { readonly id: string } } } {
        return (
          typeof value === 'object' &&
          value !== null &&
          'entry' in value &&
          typeof value.entry === 'object' &&
          value.entry !== null &&
          'sys' in value.entry &&
          typeof value.entry.sys === 'object' &&
          value.entry.sys !== null &&
          'id' in value.entry.sys &&
          typeof value.entry.sys.id === 'string'
        )
      }

      function snapshot(element: HTMLElement): HostSnapshot {
        return {
          baselineId: element.getAttribute('data-ctfl-baseline-id'),
          entryId: element.getAttribute('data-ctfl-entry-id'),
          optimizationId: element.getAttribute('data-ctfl-optimization-id'),
          sticky: element.getAttribute('data-ctfl-sticky'),
          variantIndex: element.getAttribute('data-ctfl-variant-index'),
          visibility: element.style.visibility,
        }
      }

      function createObservable<T>(current: T): ObservableValue<T> {
        return {
          get current() {
            return current
          },
          subscribe(next) {
            next(current)

            return { unsubscribe: () => undefined }
          },
          subscribeOnce(next) {
            if (current !== undefined && current !== null) {
              next(current)
            }

            return { unsubscribe: () => undefined }
          },
        }
      }

      if (!isOptimizedEntryElement(node)) {
        throw new Error('Expected the reference element to be a ctfl-optimized-entry.')
      }

      const element = node
      const baselineEntry = element.baselineEntry
      if (!baselineEntry) {
        throw new Error('Expected the reference entry to have a baselineEntry.')
      }

      const resolvedEntryIds: string[] = []
      const beforeUnset = snapshot(element)

      element.addEventListener('ctfl-entry-resolved', (event) => {
        if (!(event instanceof CustomEvent)) return

        const detail: unknown = event.detail
        if (isResolvedEntryDetail(detail)) {
          resolvedEntryIds.push(detail.entry.sys.id)
        }
      })

      element.baselineEntry = undefined
      const afterUnset = snapshot(element)

      element.baselineEntry = baselineEntry
      await new Promise((resolve) => {
        requestAnimationFrame(resolve)
      })
      const afterReset = snapshot(element)

      const loadingElement = document.createElement('ctfl-optimized-entry')
      if (!isOptimizedEntryElement(loadingElement)) {
        throw new Error('Expected the dynamic element to be a ctfl-optimized-entry.')
      }

      loadingElement.sdk = {
        destroy: () => undefined,
        resolveOptimizedEntry: (entry: unknown) => ({ entry, selectedOptimization: undefined }),
        setLocale: () => undefined,
        states: {
          canOptimize: createObservable(false),
          experienceRequestState: createObservable({ status: 'idle' }),
          previewPanelOpen: createObservable(false),
          selectedOptimizations: createObservable(undefined),
        },
      }
      loadingElement.baselineEntry = baselineEntry
      document.body.append(loadingElement)
      const loadingBeforeUnset = snapshot(loadingElement)
      loadingElement.baselineEntry = undefined
      const loadingAfterUnset = snapshot(loadingElement)
      loadingElement.remove()

      return {
        afterReset,
        afterUnset,
        beforeUnset,
        loadingAfterUnset,
        loadingBeforeUnset,
        resolvedEntryIds,
      }
    })

    expect(resetResult.beforeUnset).toMatchObject({
      baselineId: '5XHssysWUDECHzKLzoIsg1',
      entryId: '4bmHsNUaEibELHwWCon3dt',
      optimizationId: expect.any(String),
      sticky: expect.any(String),
      variantIndex: expect.any(String),
    })
    expect(resetResult.afterUnset).toEqual({
      baselineId: null,
      entryId: null,
      optimizationId: null,
      sticky: null,
      variantIndex: null,
      visibility: '',
    })
    expect(resetResult.resolvedEntryIds).toContain(resetResult.beforeUnset.entryId)
    expect(resetResult.afterReset).toEqual(resetResult.beforeUnset)
    expect(resetResult.loadingBeforeUnset).toMatchObject({
      baselineId: null,
      entryId: null,
      optimizationId: null,
      sticky: null,
      variantIndex: null,
      visibility: 'hidden',
    })
    expect(resetResult.loadingAfterUnset).toEqual({
      baselineId: null,
      entryId: null,
      optimizationId: null,
      sticky: null,
      variantIndex: null,
      visibility: '',
    })
  })

  test('auto-binds optimized entries under custom registered root tags', async ({ page }) => {
    const result = await page.evaluate(async (manualViewEntrySelector) => {
      interface OptimizedEntryElement extends HTMLElement {
        baselineEntry?: unknown
        readonly root?: unknown
      }

      interface RootElement extends HTMLElement {
        sdk?: unknown
      }

      interface TestWindow extends Window {
        ContentfulOptimizationWebComponents: {
          defineContentfulOptimizationElements: (options: {
            optimizedEntryTagName: string
            rootTagName: string
          }) => void
        }
        contentfulOptimization: unknown
      }

      function isOptimizedEntryElement(value: unknown): value is OptimizedEntryElement {
        return value instanceof HTMLElement && 'baselineEntry' in value
      }

      function isRootElement(value: unknown): value is RootElement {
        return value instanceof HTMLElement && 'sdk' in value
      }

      function isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null
      }

      function hasReferenceRuntime(value: Window): value is TestWindow {
        const components =
          'ContentfulOptimizationWebComponents' in value
            ? value.ContentfulOptimizationWebComponents
            : undefined

        return (
          isRecord(components) &&
          typeof components.defineContentfulOptimizationElements === 'function' &&
          'contentfulOptimization' in value &&
          value.contentfulOptimization !== undefined
        )
      }

      if (!hasReferenceRuntime(window)) {
        throw new Error('Expected the reference Web SDK runtime to be initialized.')
      }

      const testWindow = window
      const components = testWindow.ContentfulOptimizationWebComponents
      const sdk = testWindow.contentfulOptimization
      const source = document.querySelector(manualViewEntrySelector)
      if (!isOptimizedEntryElement(source) || !source.baselineEntry) {
        throw new Error('Expected the reference Web SDK runtime to be initialized.')
      }

      const rootTagName = 'ctfl-e2e-optimization-root'
      const optimizedEntryTagName = 'ctfl-e2e-optimized-entry'
      components.defineContentfulOptimizationElements({ optimizedEntryTagName, rootTagName })

      const root = document.createElement(rootTagName)
      const entry = document.createElement(optimizedEntryTagName)
      const fixture = document.createElement('div')
      if (!isRootElement(root) || !isOptimizedEntryElement(entry)) {
        throw new Error('Expected custom elements to be registered.')
      }

      fixture.dataset.testid = 'custom-tag-fixture'
      root.sdk = sdk
      entry.baselineEntry = source.baselineEntry
      root.append(entry)
      fixture.append(root)
      document.body.append(fixture)

      await new Promise((resolve) => {
        requestAnimationFrame(resolve)
      })

      const result = {
        explicitRootWasUnset: entry.root === undefined,
        resolvedEntryId: entry.getAttribute('data-ctfl-entry-id'),
        rootTagName: root.tagName.toLowerCase(),
        tagName: entry.tagName.toLowerCase(),
      }

      fixture.remove()

      return result
    }, MANUAL_VIEW_ENTRY_SELECTOR)

    expect(result).toEqual({
      explicitRootWasUnset: true,
      resolvedEntryId: '4bmHsNUaEibELHwWCon3dt',
      rootTagName: 'ctfl-e2e-optimization-root',
      tagName: 'ctfl-e2e-optimized-entry',
    })
  })

  test('preserves initial preview-panel-open state for late-created roots', async ({ page }) => {
    const result = await page.evaluate(async (manualViewEntrySelector) => {
      interface Signal<T> {
        value: T
      }

      interface SelectedOptimization {
        readonly experienceId: string
        readonly sticky?: boolean
        readonly variantIndex: number
        readonly variants?: Record<string, string>
      }

      interface PreviewSignals {
        readonly previewPanelOpen: Signal<boolean>
        readonly selectedOptimizations: Signal<SelectedOptimization[] | undefined>
      }

      interface OptimizedEntryElement extends HTMLElement {
        baselineEntry?: unknown
      }

      interface RootElement extends HTMLElement {
        sdk?: unknown
      }

      interface TestSdk {
        readonly states: {
          readonly selectedOptimizations: { readonly current: SelectedOptimization[] | undefined }
        }
        readonly registerPreviewPanel: (target: Record<PropertyKey, unknown>) => void
      }

      interface TestWindow extends Window {
        contentfulOptimization: TestSdk
      }

      function isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null
      }

      function isOptimizedEntryElement(value: unknown): value is OptimizedEntryElement {
        return value instanceof HTMLElement && 'baselineEntry' in value
      }

      function isRootElement(value: unknown): value is RootElement {
        return value instanceof HTMLElement && 'sdk' in value
      }

      function isSignal<T>(value: unknown): value is Signal<T> {
        return isRecord(value) && 'value' in value
      }

      function isPreviewSignals(value: unknown): value is PreviewSignals {
        return (
          isRecord(value) &&
          isSignal<boolean>(value.previewPanelOpen) &&
          isSignal<SelectedOptimization[] | undefined>(value.selectedOptimizations)
        )
      }

      function hasReferenceSdk(value: Window): value is TestWindow {
        return (
          'contentfulOptimization' in value &&
          isRecord(value.contentfulOptimization) &&
          'states' in value.contentfulOptimization &&
          isRecord(value.contentfulOptimization.states) &&
          'selectedOptimizations' in value.contentfulOptimization.states &&
          isRecord(value.contentfulOptimization.states.selectedOptimizations) &&
          'current' in value.contentfulOptimization.states.selectedOptimizations &&
          typeof value.contentfulOptimization.registerPreviewPanel === 'function'
        )
      }

      function readEntryId(entry: unknown): string {
        if (!isRecord(entry) || !isRecord(entry.sys) || typeof entry.sys.id !== 'string') {
          throw new Error('Expected the baseline entry to have an ID.')
        }

        return entry.sys.id
      }

      function snapshot(element: HTMLElement): HostSnapshot {
        return {
          baselineId: element.getAttribute('data-ctfl-baseline-id'),
          entryId: element.getAttribute('data-ctfl-entry-id'),
          optimizationId: element.getAttribute('data-ctfl-optimization-id'),
          sticky: element.getAttribute('data-ctfl-sticky'),
          variantIndex: element.getAttribute('data-ctfl-variant-index'),
          visibility: element.style.visibility,
        }
      }

      if (!hasReferenceSdk(window)) {
        throw new Error('Expected the reference Web SDK runtime to be initialized.')
      }

      const sdk = window.contentfulOptimization
      const source = document.querySelector(manualViewEntrySelector)
      if (!isOptimizedEntryElement(source) || !source.baselineEntry) {
        throw new Error('Expected the reference Web SDK runtime to be initialized.')
      }

      const baselineEntryId = readEntryId(source.baselineEntry)

      const signalTarget: Record<PropertyKey, unknown> = {}
      sdk.registerPreviewPanel(signalTarget)
      const signals = Reflect.get(signalTarget, Symbol.for('ctfl.optimization.preview.signals'))
      if (!isPreviewSignals(signals)) {
        throw new Error('Expected preview panel signals to be registered.')
      }

      const selectedOptimizations = sdk.states.selectedOptimizations.current ?? []
      const selectedOptimization = selectedOptimizations.find(
        (optimization) => optimization.variants?.[baselineEntryId] !== undefined,
      )
      if (!selectedOptimization) {
        throw new Error('Expected a selected optimization for the baseline entry.')
      }

      signals.previewPanelOpen.value = true

      const root = document.createElement('ctfl-optimization-root')
      const entry = document.createElement('ctfl-optimized-entry')
      const fixture = document.createElement('div')
      if (!isRootElement(root) || !isOptimizedEntryElement(entry)) {
        throw new Error('Expected default Web Components to be registered.')
      }

      fixture.dataset.testid = 'preview-open-fixture'
      root.sdk = sdk
      entry.setAttribute('live-updates', 'false')
      entry.baselineEntry = source.baselineEntry
      root.append(entry)
      fixture.append(root)
      document.body.append(fixture)

      await new Promise((resolve) => {
        requestAnimationFrame(resolve)
      })

      const beforeUpdate = snapshot(entry)
      const nextVariantIndex = selectedOptimization.variantIndex === 0 ? 1 : 0
      const expectedEntryId =
        nextVariantIndex === 0 ? baselineEntryId : selectedOptimization.variants?.[baselineEntryId]

      const resolvedAfterUpdate = new Promise<boolean>((resolve) => {
        const timeout = window.setTimeout(() => {
          resolve(false)
        }, 1000)

        entry.addEventListener(
          'ctfl-entry-resolved',
          () => {
            window.clearTimeout(timeout)
            resolve(true)
          },
          { once: true },
        )
      })

      signals.selectedOptimizations.value = selectedOptimizations.map((optimization) =>
        optimization.experienceId === selectedOptimization.experienceId
          ? { ...optimization, variantIndex: nextVariantIndex }
          : optimization,
      )

      const didResolveAfterUpdate = await resolvedAfterUpdate
      const afterUpdate = snapshot(entry)

      fixture.remove()
      signals.previewPanelOpen.value = false
      signals.selectedOptimizations.value = selectedOptimizations

      return {
        afterUpdate,
        beforeUpdate,
        didResolveAfterUpdate,
        expectedEntryId,
        nextVariantIndex,
        previewPanelOpenAtCreation: true,
      }
    }, MANUAL_VIEW_ENTRY_SELECTOR)

    expect(result.previewPanelOpenAtCreation).toBe(true)
    expect(result.beforeUpdate.entryId).toBe('4bmHsNUaEibELHwWCon3dt')
    expect(result.didResolveAfterUpdate).toBe(true)
    expect(result.afterUpdate.entryId).toBe(result.expectedEntryId)
    expect(result.afterUpdate.variantIndex).toBe(String(result.nextVariantIndex))
    expect(result.afterUpdate.entryId).not.toBe(result.beforeUpdate.entryId)
  })
})

import type { TestEntry } from '../test/sdkTestUtils'
export {
  createRuntime,
  defaultLiveUpdatesContext,
  createTestEntry as makeEntry,
  createOptimizableTestEntry as makeOptimizableEntry,
  renderWithOptimizationProviders as renderComponent,
  renderWithOptimizationProvidersToString as renderComponentToString,
  type RuntimeOptimization,
  type SelectedOptimizationState,
  type TestEntry,
} from '../test/sdkTestUtils'

export function renderToStringWithoutWindow(render: () => string): string {
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

export function getWrapper(container: HTMLElement): HTMLElement {
  const { firstElementChild: wrapper } = container

  if (!(wrapper instanceof HTMLElement)) {
    throw new TypeError('Expected first child to be an HTMLElement')
  }

  return wrapper
}

export function getRequiredElement(container: HTMLElement, selector: string): HTMLElement {
  const target = container.querySelector(selector)

  if (!(target instanceof HTMLElement)) {
    throw new TypeError(`Expected selector "${selector}" to resolve to an HTMLElement`)
  }

  return target
}

export function readTitle(entry: TestEntry): string {
  const {
    fields: { title },
  } = entry
  return typeof title === 'string' ? title : ''
}

import { describe, expect, it, rs } from '@rstest/core'
import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { OptimizationProvider } from '../index'

const constructorCalls: Array<Record<string, unknown>> = []
const setConfigCalls: Array<Record<string, unknown>> = []

let mockInstanceCount = 0

rs.mock('@contentful/optimization-web', () => {
  class MockContentfulOptimization {
    readonly instanceId: number

    constructor(config: Record<string, unknown>) {
      this.instanceId = ++mockInstanceCount
      constructorCalls.push(config)
      Reflect.set(window, 'contentfulOptimization', this)
    }

    destroy(): void {
      Reflect.deleteProperty(window, 'contentfulOptimization')
    }

    setLocale(locale: string): string {
      return locale
    }

    setConfig(patch: Record<string, unknown>): void {
      setConfigCalls.push(patch)
    }

    static getOrCreate(config: Record<string, unknown>): MockContentfulOptimization {
      const current: unknown = Reflect.get(window, 'contentfulOptimization')
      if (current instanceof MockContentfulOptimization) {
        current.setConfig(config)
        return current
      }
      return new MockContentfulOptimization(config)
    }
  }

  return { isBrowser: () => true, default: MockContentfulOptimization }
})

function renderProvider(element: ReactElement): {
  unmount: () => void
  update: (element: ReactElement) => void
} {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(element)
  })

  return {
    update(nextElement: ReactElement) {
      act(() => {
        root.render(nextElement)
      })
    },
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

const BASE_PROPS = { clientId: 'test-client-id', environment: 'main' }

describe('OptimizationProvider singleton lifecycle', () => {
  beforeEach(() => {
    constructorCalls.length = 0
    setConfigCalls.length = 0
    mockInstanceCount = 0
  })

  afterEach(() => {
    window.contentfulOptimization?.destroy()
    delete window.contentfulOptimization
  })

  it('creates a new SDK when no singleton exists on mount', () => {
    const rendered = renderProvider(
      <OptimizationProvider {...BASE_PROPS}>
        <div />
      </OptimizationProvider>,
    )

    expect(constructorCalls).toHaveLength(1)

    rendered.unmount()
  })

  it('adopts the existing singleton instead of constructing a new one when window.contentfulOptimization is already set on mount', () => {
    const rendered = renderProvider(
      <OptimizationProvider {...BASE_PROPS}>
        <div />
      </OptimizationProvider>,
    )

    expect(constructorCalls).toHaveLength(1)
    const firstInstanceId = mockInstanceCount

    const rendered2 = renderProvider(
      <OptimizationProvider {...BASE_PROPS}>
        <div />
      </OptimizationProvider>,
    )

    expect(constructorCalls).toHaveLength(1)
    expect(mockInstanceCount).toBe(firstInstanceId)

    rendered.unmount()
    rendered2.unmount()
  })

  it('calls setConfig with current props when adopting an existing singleton', () => {
    const rendered = renderProvider(
      <OptimizationProvider {...BASE_PROPS}>
        <div />
      </OptimizationProvider>,
    )

    setConfigCalls.length = 0

    const rendered2 = renderProvider(
      <OptimizationProvider {...BASE_PROPS} locale="de-DE">
        <div />
      </OptimizationProvider>,
    )

    expect(setConfigCalls.length).toBeGreaterThanOrEqual(1)
    expect(setConfigCalls.some((c) => c.locale === 'de-DE')).toBe(true)

    rendered.unmount()
    rendered2.unmount()
  })

  it('does not call destroy on unmount', () => {
    const destroySpy = rs.fn()
    const rendered = renderProvider(
      <OptimizationProvider {...BASE_PROPS}>
        <div />
      </OptimizationProvider>,
    )

    const sdk = window.contentfulOptimization
    if (sdk) sdk.destroy = destroySpy

    rendered.unmount()

    expect(destroySpy).not.toHaveBeenCalled()
  })

  it('calls setConfig when a mutable prop (locale) changes on re-render', () => {
    const rendered = renderProvider(
      <OptimizationProvider {...BASE_PROPS} locale="en-US">
        <div />
      </OptimizationProvider>,
    )

    setConfigCalls.length = 0

    rendered.update(
      <OptimizationProvider {...BASE_PROPS} locale="de-DE">
        <div />
      </OptimizationProvider>,
    )

    expect(setConfigCalls).toHaveLength(1)
    expect(setConfigCalls[0]).toMatchObject({ locale: 'de-DE' })

    rendered.unmount()
  })

  it('calls setConfig when autoTrackEntryInteraction changes on re-render', () => {
    const rendered = renderProvider(
      <OptimizationProvider {...BASE_PROPS} trackEntryInteraction={{ views: true }}>
        <div />
      </OptimizationProvider>,
    )

    setConfigCalls.length = 0

    rendered.update(
      <OptimizationProvider {...BASE_PROPS} trackEntryInteraction={{ views: false }}>
        <div />
      </OptimizationProvider>,
    )

    expect(setConfigCalls).toHaveLength(1)
    expect(setConfigCalls[0]).toMatchObject({
      autoTrackEntryInteraction: expect.objectContaining({ views: false }),
    })

    rendered.unmount()
  })

  it('only constructs one SDK instance across a StrictMode unmount+remount cycle when a singleton already exists', () => {
    const rendered = renderProvider(
      <OptimizationProvider {...BASE_PROPS}>
        <div />
      </OptimizationProvider>,
    )

    const countAfterFirst = constructorCalls.length

    rendered.update(
      <OptimizationProvider {...BASE_PROPS}>
        <div />
      </OptimizationProvider>,
    )

    expect(constructorCalls.length).toBe(countAfterFirst)

    rendered.unmount()
  })
})

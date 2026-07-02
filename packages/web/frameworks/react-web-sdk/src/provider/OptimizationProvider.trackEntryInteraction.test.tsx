import { describe, expect, it, rs } from '@rstest/core'
import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { OptimizationProvider } from '../index'

const constructedConfigs: Array<Record<string, unknown>> = []
const setConfigCalls: Array<Record<string, unknown>> = []

rs.mock('@contentful/optimization-web', () => {
  class MockContentfulOptimization {
    constructor(config: Record<string, unknown>) {
      constructedConfigs.push(config)
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

function requireConfig(index: number): Record<string, unknown> {
  const config = constructedConfigs[index]

  if (config === undefined) {
    throw new Error('Expected SDK config to be captured')
  }

  return config
}

describe('OptimizationProvider trackEntryInteraction', () => {
  it('maps default React tracking options to Web SDK auto tracking options', () => {
    constructedConfigs.length = 0
    setConfigCalls.length = 0

    const rendered = renderProvider(
      <OptimizationProvider clientId="test-client-id" environment="main">
        <div />
      </OptimizationProvider>,
    )

    expect(requireConfig(0).autoTrackEntryInteraction).toEqual({
      clicks: true,
      hovers: true,
      views: true,
    })

    rendered.unmount()
  })

  it('maps explicit React tracking options to Web SDK auto tracking options', () => {
    constructedConfigs.length = 0
    setConfigCalls.length = 0

    const rendered = renderProvider(
      <OptimizationProvider
        clientId="test-client-id"
        environment="main"
        trackEntryInteraction={{ clicks: false, views: false }}
      >
        <div />
      </OptimizationProvider>,
    )

    const config = requireConfig(0)
    expect(config.autoTrackEntryInteraction).toEqual({
      clicks: false,
      hovers: true,
      views: false,
    })
    expect(config).not.toHaveProperty('trackEntryInteraction')

    rendered.unmount()
  })

  it('updates the owned SDK when the locale prop changes', () => {
    constructedConfigs.length = 0
    setConfigCalls.length = 0

    const rendered = renderProvider(
      <OptimizationProvider clientId="test-client-id" environment="main" locale="en-US">
        <div />
      </OptimizationProvider>,
    )

    expect(setConfigCalls.some((c) => c.locale === 'en-US')).toBe(true)

    rendered.update(
      <OptimizationProvider clientId="test-client-id" environment="main" locale="de-DE">
        <div />
      </OptimizationProvider>,
    )

    expect(setConfigCalls.some((c) => c.locale === 'de-DE')).toBe(true)

    rendered.unmount()
  })
})

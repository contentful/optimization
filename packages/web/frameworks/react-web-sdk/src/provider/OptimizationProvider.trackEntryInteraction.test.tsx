import { describe, expect, it, rs } from '@rstest/core'
import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { OptimizationProvider } from '../index'

const constructedConfigs: Array<Record<string, unknown>> = []

rs.mock('@contentful/optimization-web', () => ({
  default: class MockContentfulOptimization {
    constructor(config: Record<string, unknown>) {
      constructedConfigs.push(config)
      Reflect.set(window, 'contentfulOptimization', this)
    }

    destroy(): void {
      void this
      Reflect.deleteProperty(window, 'contentfulOptimization')
    }
  },
}))

function renderProvider(element: ReactElement): { unmount: () => void } {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  act(() => {
    root.render(element)
  })

  return {
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function requireConfig(index: number): Record<string, unknown> {
  const { [index]: config } = constructedConfigs

  if (config === undefined) {
    throw new Error('Expected SDK config to be captured')
  }

  return config
}

describe('OptimizationProvider trackEntryInteraction', () => {
  it('maps default React tracking options to Web SDK auto tracking options', () => {
    constructedConfigs.length = 0

    const rendered = renderProvider(
      <OptimizationProvider clientId="test-client-id" environment="main">
        <div />
      </OptimizationProvider>,
    )

    expect(requireConfig(0).autoTrackEntryInteraction).toEqual({
      clicks: false,
      hovers: false,
      views: true,
    })

    rendered.unmount()
  })

  it('maps explicit React tracking options to Web SDK auto tracking options', () => {
    constructedConfigs.length = 0

    const rendered = renderProvider(
      <OptimizationProvider
        clientId="test-client-id"
        environment="main"
        trackEntryInteraction={{ clicks: true, views: false }}
      >
        <div />
      </OptimizationProvider>,
    )

    const config = requireConfig(0)
    expect(config.autoTrackEntryInteraction).toEqual({
      clicks: true,
      hovers: false,
      views: false,
    })
    expect(config).not.toHaveProperty('trackEntryInteraction')

    rendered.unmount()
  })
})

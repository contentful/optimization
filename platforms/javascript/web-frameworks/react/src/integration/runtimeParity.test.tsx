import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { OptimizationProvider } from '../components/OptimizationProvider'
import { useOptimization } from '../hooks/useOptimization'
import { setupMswServerLifecycle } from '../test/mswServer'

setupMswServerLifecycle()

function Probe(): React.JSX.Element {
  const optimization = useOptimization()

  return <span data-testid="probe">{String(Boolean(optimization))}</span>
}

describe('runtime parity', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'optimization')
    Reflect.deleteProperty(window, 'Optimization')
  })

  it('initializes for server-rendered flow', () => {
    const html = renderToString(
      <OptimizationProvider config={{ clientId: 'key_123', environment: 'main' }}>
        <Probe />
      </OptimizationProvider>,
    )

    expect(html).toContain('true')
  })

  it('initializes for client-rendered flow', () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    act(() => {
      root.render(
        <OptimizationProvider config={{ clientId: 'key_123', environment: 'main' }}>
          <Probe />
        </OptimizationProvider>,
      )
    })

    expect(container.querySelector('[data-testid="probe"]')?.textContent).toBe('true')
  })
})

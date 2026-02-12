import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { useOptimization } from '../hooks/useOptimization'
import { OptimizationProvider } from './OptimizationProvider'

function HookProbe(): React.JSX.Element {
  const optimization = useOptimization()

  return <span data-testid="optimization-ready">{String(Boolean(optimization))}</span>
}

describe('OptimizationProvider', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'optimization')
    Reflect.deleteProperty(window, 'Optimization')
  })

  it('provides an Optimization instance to descendants', () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    act(() => {
      root.render(
        <OptimizationProvider config={{ clientId: 'key_123', environment: 'main' }}>
          <HookProbe />
        </OptimizationProvider>,
      )
    })

    expect(container.querySelector('[data-testid="optimization-ready"]')?.textContent).toBe('true')
  })

  it('throws if useOptimization is used outside provider', () => {
    expect(() => {
      renderToString(<HookProbe />)
    }).toThrowError(/useOptimization must be used within an OptimizationProvider/)
  })
})

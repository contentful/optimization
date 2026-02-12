import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { OptimizationConsumer } from '../components/OptimizationConsumer'
import { OptimizationProvider } from '../components/OptimizationProvider'
import { capabilityMapping } from '../contracts/capabilityMapping'
import { setupMswServerLifecycle } from '../test/mswServer'

setupMswServerLifecycle()

describe('migration replacement', () => {
  it('supports full replacement via provider + consumer usage path', () => {
    const html = renderToString(
      <OptimizationProvider config={{ clientId: 'key_123', environment: 'main' }}>
        <OptimizationConsumer>
          {(optimization) => <span>{String(Boolean(optimization))}</span>}
        </OptimizationConsumer>
      </OptimizationProvider>,
    )

    expect(html).toContain('true')
  })

  it('documents capability mapping entries for parity coverage', () => {
    expect(capabilityMapping.length).toBeGreaterThan(0)
    expect(capabilityMapping.every((entry) => entry.reactAccessPath.length > 0)).toBe(true)
  })
})

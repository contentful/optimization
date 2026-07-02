import type ContentfulOptimization from '@contentful/optimization-web'
import type { OptimizationSdk } from './OptimizationContext'

export function acceptReactWebSdk(runtime: ContentfulOptimization): OptimizationSdk {
  return runtime
}

describe('React Web OptimizationSdk type contract', () => {
  it('is satisfied by the concrete Web SDK runtime', () => {
    // The live ContentfulOptimization instance is assignable to OptimizationSdk
    // (verified by acceptReactWebSdk type-checking). OptimizationSdk is the
    // broader isomorphic runtime surface, so the reverse is intentionally not
    // guaranteed — a snapshot runtime also satisfies it on the server.
    expect(true).toBe(true)
  })
})

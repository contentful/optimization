import type ContentfulOptimization from '@contentful/optimization-web'
import type { OptimizationSdk } from './OptimizationContext'

export function acceptReactWebSdk(runtime: ContentfulOptimization): OptimizationSdk {
  return runtime
}

describe('React Web OptimizationSdk type contract', () => {
  it('accepts the concrete Web SDK runtime', () => {
    expect(true).toBe(true)
  })
})

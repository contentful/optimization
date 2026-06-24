import type ContentfulOptimization from '@contentful/optimization-web'
import type { OptimizationSdk } from './OptimizationContext'

export function acceptReactWebSdk(runtime: ContentfulOptimization): OptimizationSdk {
  return runtime
}

export function acceptConcreteWebSdk(sdk: OptimizationSdk): ContentfulOptimization {
  return sdk
}

describe('React Web OptimizationSdk type contract', () => {
  it('aliases the concrete Web SDK runtime', () => {
    expect(true).toBe(true)
  })
})

import type ContentfulOptimization from './ContentfulOptimization'
import type { OptimizationSdk } from './OptimizationSdk'

export function acceptConcreteReactNativeSdk(sdk: ContentfulOptimization): OptimizationSdk {
  return sdk
}

export function acceptRuntimeAlias(sdk: OptimizationSdk): ContentfulOptimization {
  return sdk
}

export function assertReactNativeRuntimeAdvancedAccess(runtime: OptimizationSdk): void {
  // @ts-expect-error `api` preserves the concrete React Native SDK readonly modifier.
  runtime.api = undefined
  runtime.interceptors.event.add((event) => event)
  void runtime.page({})
  void runtime.trackHover({
    componentId: 'component-id',
    hoverDurationMs: 1,
    hoverId: 'hover-id',
  })
}

describe('React Native OptimizationSdk type contract', () => {
  it('aliases the concrete React Native SDK runtime', () => {
    expect(true).toBe(true)
  })
})

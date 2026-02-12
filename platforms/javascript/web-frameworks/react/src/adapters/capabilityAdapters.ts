import type { Optimization } from '@contentful/optimization-web'

export interface ReactCapabilityAdapters {
  getOptimization: () => Optimization
}

export function createReactCapabilityAdapters(
  getOptimization: () => Optimization,
): ReactCapabilityAdapters {
  return {
    getOptimization,
  }
}

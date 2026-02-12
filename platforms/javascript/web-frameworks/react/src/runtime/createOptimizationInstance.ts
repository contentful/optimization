import { Optimization as WebOptimization } from '@contentful/optimization-web'

export type ReactSdkConfig = ConstructorParameters<typeof WebOptimization>[0]

export interface ReactOptimizationInstance {
  readonly webInstance: WebOptimization
  readonly runtimeMode: 'browser' | 'server'
  status: 'uninitialized' | 'ready' | 'error' | 'destroyed'
  destroy: () => void
}

function hasDestroyMethod(value: unknown): value is { destroy: () => void } {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return typeof Reflect.get(value, 'destroy') === 'function'
}

export function createOptimizationInstance(config: ReactSdkConfig): ReactOptimizationInstance {
  const runtimeMode: 'browser' | 'server' = typeof window === 'undefined' ? 'server' : 'browser'

  const webInstance = new WebOptimization(config)

  return {
    webInstance,
    runtimeMode,
    status: 'ready',
    destroy: () => {
      if (hasDestroyMethod(webInstance)) {
        webInstance.destroy()
      }
    },
  }
}

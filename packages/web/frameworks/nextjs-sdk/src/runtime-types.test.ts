import type NodeContentfulOptimization from '@contentful/optimization-node'
import type WebContentfulOptimization from '@contentful/optimization-web'
import type { OptimizationSdk } from './client'
import type { ContentfulOptimization as NextjsServerOptimization } from './server'

export function acceptNextjsClientSdk(runtime: WebContentfulOptimization): OptimizationSdk {
  return runtime
}

export function acceptNextjsServerSdk(
  runtime: NodeContentfulOptimization,
): NextjsServerOptimization {
  return runtime
}

export function acceptConcreteNodeRuntime(
  sdk: NextjsServerOptimization,
): NodeContentfulOptimization {
  return sdk
}

export function assertBrowserRuntimeIsNotServerRuntime(runtime: OptimizationSdk): void {
  // @ts-expect-error browser runtimes do not expose the required server request binding.
  const serverRuntime: NextjsServerOptimization = runtime
  void serverRuntime
}

describe('Next.js runtime type contracts', () => {
  it('keeps client and server runtimes distinct', () => {
    expect(true).toBe(true)
  })
})

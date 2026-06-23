import { createContext, useContext, type Context } from 'react'
import type { OptimizationSdk } from '../OptimizationSdk'

/**
 * @internal
 */
interface OptimizationContextValue {
  sdk: OptimizationSdk | undefined
  isReady: boolean
  error: Error | undefined
}

/**
 * React Context that holds the {@link ContentfulOptimization} instance.
 *
 * @internal
 */
// The preview entry point is bundled separately; both bundles must use one context.
const OPTIMIZATION_CONTEXT_SYMBOL = Symbol.for(
  '@contentful/optimization-react-native/OptimizationContext',
)

const globalContextRegistry = globalThis as typeof globalThis &
  Record<symbol, Context<OptimizationContextValue | null> | undefined>

const OptimizationContext =
  globalContextRegistry[OPTIMIZATION_CONTEXT_SYMBOL] ??
  createContext<OptimizationContextValue | null>(null)

globalContextRegistry[OPTIMIZATION_CONTEXT_SYMBOL] = OptimizationContext

/**
 * Returns the {@link ContentfulOptimization} instance from the nearest {@link OptimizationProvider}.
 *
 * @returns The current {@link ContentfulOptimization} instance
 *
 * @throws Error if called outside of an {@link OptimizationProvider}
 * @throws Error if the SDK failed to initialize or is still initializing
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const optimization = useOptimization()
 *
 *   const handlePress = async () => {
 *     await optimization.trackView({
 *       componentId: 'my-component',
 *       variantIndex: 0,
 *     })
 *   }
 *
 *   return <Button onPress={handlePress} title="Track" />
 * }
 * ```
 *
 * @public
 */
export function useOptimization(): OptimizationSdk {
  const context = useContext(OptimizationContext)

  if (!context) {
    throw new Error(
      'useOptimization must be used within an OptimizationProvider or OptimizationRoot. ' +
        'Make sure to wrap your component tree with <OptimizationRoot> or <OptimizationProvider>.',
    )
  }

  if (!context.sdk || !context.isReady) {
    if (context.error) {
      throw new Error(`ContentfulOptimization SDK failed to initialize: ${context.error.message}`, {
        cause: context.error,
      })
    }

    throw new Error(
      'ContentfulOptimization SDK is still initializing. ' +
        'This should not happen when using the loading gate in OptimizationProvider.',
    )
  }

  return context.sdk
}

export default OptimizationContext

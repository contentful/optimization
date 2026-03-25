import { createContext, useContext } from 'react'
import type ContentfulOptimization from '../ContentfulOptimization'

/**
 * @internal
 */
interface OptimizationContextValue {
  instance: ContentfulOptimization | null
  isReady: boolean
  initError: Error | null
}

/**
 * React Context that holds the {@link ContentfulOptimization} instance.
 *
 * @internal
 */
const OptimizationContext = createContext<OptimizationContextValue | null>(null)

/**
 * Returns the {@link ContentfulOptimization} instance from the nearest {@link OptimizationProvider}.
 *
 * @returns The current {@link ContentfulOptimization} instance
 *
 * @throws Error if called outside of an {@link OptimizationProvider}
 * @throws Error if the SDK is still initializing
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
export function useOptimization(): ContentfulOptimization {
  const context = useContext(OptimizationContext)

  if (!context) {
    throw new Error(
      'useOptimization must be used within an OptimizationProvider or OptimizationRoot. ' +
        'Make sure to wrap your component tree with <OptimizationRoot> or <OptimizationProvider>.',
    )
  }

  if (!context.instance) {
    throw new Error(
      'ContentfulOptimization SDK is still initializing. ' +
        'This should not happen when using the loading gate in OptimizationProvider.',
    )
  }

  return context.instance
}

export default OptimizationContext

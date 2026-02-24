import { createContext, useContext } from 'react'
import type Optimization from '../'

/**
 * @internal
 */
interface OptimizationContextValue {
  instance: Optimization
}

/**
 * React Context that holds the Optimization instance.
 *
 * @internal
 */
const OptimizationContext = createContext<OptimizationContextValue | null>(null)

/**
 * Returns the Optimization instance from the nearest {@link OptimizationProvider}.
 *
 * @returns The current Optimization instance
 *
 * @throws Error if called outside of an {@link OptimizationProvider}
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const optimization = useOptimization()
 *
 *   const handlePress = async () => {
 *     await optimization.analytics.trackComponentView({
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
export function useOptimization(): Optimization {
  const context = useContext(OptimizationContext)

  if (!context) {
    throw new Error(
      'useOptimization must be used within an OptimizationProvider. ' +
        'Make sure to wrap your component tree with <OptimizationProvider instance={optimizationInstance}>.',
    )
  }

  return context.instance
}

export default OptimizationContext

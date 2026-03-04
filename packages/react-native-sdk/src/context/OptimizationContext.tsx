import { createContext, useContext } from 'react'
import type OptimizationReactNativeSdk from '../OptimizationReactNativeSdk'

/**
 * @internal
 */
interface OptimizationContextValue {
  instance: OptimizationReactNativeSdk | null
  isReady: boolean
  initError: Error | null
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
 * @throws Error if the SDK is still initializing
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const optimization = useOptimization()
 *
 *   const handlePress = async () => {
 *     await optimization.trackComponentView({
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
export function useOptimization(): OptimizationReactNativeSdk {
  const context = useContext(OptimizationContext)

  if (!context) {
    throw new Error(
      'useOptimization must be used within an OptimizationProvider. ' +
        'Make sure to wrap your component tree with <OptimizationProvider clientId="...">.',
    )
  }

  if (!context.instance) {
    throw new Error(
      'Optimization SDK is still initializing. ' +
        'This should not happen when using the loading gate in OptimizationProvider.',
    )
  }

  return context.instance
}

export default OptimizationContext

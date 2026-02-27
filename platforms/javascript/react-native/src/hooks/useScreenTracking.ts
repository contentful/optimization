import {
  createScopedLogger,
  type OptimizationData,
  type Properties,
} from '@contentful/optimization-core'
import { useCallback, useEffect, useRef } from 'react'
import { useOptimization } from '../context/OptimizationContext'

const logger = createScopedLogger('RN:ScreenTracking')

/**
 * Options for the {@link useScreenTracking} hook.
 *
 * @public
 */
export interface UseScreenTrackingOptions {
  /**
   * The name of the screen to track.
   */
  name: string

  /**
   * Additional properties to attach to the screen event.
   */
  properties?: Properties

  /**
   * Whether to automatically track the screen on mount.
   *
   * @defaultValue true
   */
  trackOnMount?: boolean
}

/**
 * Return value of the {@link useScreenTracking} hook.
 *
 * @public
 */
export interface UseScreenTrackingReturn {
  /**
   * Manually trigger screen tracking.
   * Useful when `trackOnMount` is `false` or for re-tracking.
   */
  trackScreen: () => Promise<OptimizationData | undefined>
}

const EMPTY_PROPERTIES: Properties = {}

/**
 * Returns a stable callback to track screen views with dynamic names.
 * Use this when screen names are not known at render time (e.g. navigation state).
 *
 * @returns A function that tracks a screen view given name and optional properties.
 *
 * @public
 */
export function useScreenTrackingCallback(): (name: string, properties?: Properties) => void {
  const optimization = useOptimization()
  const optimizationRef = useRef(optimization)
  optimizationRef.current = optimization

  return useCallback((name: string, properties?: Properties) => {
    const { current: currentOptimization } = optimizationRef

    logger.info(`Tracking screen: "${name}"`)

    void currentOptimization.screen({
      name,
      properties: properties ?? EMPTY_PROPERTIES,
      screen: { name },
    })
  }, [])
}

/**
 * Hook for tracking screen views in React Native.
 *
 * By default, tracks the screen automatically when the component mounts.
 * Set `trackOnMount: false` to disable automatic tracking and use the
 * returned `trackScreen` function for manual control.
 *
 * @param options - Screen tracking options
 * @returns Object containing a `trackScreen` function for manual triggering
 *
 * @throws Error if called outside of an {@link OptimizationProvider}
 *
 * @example
 * ```tsx
 * // Automatic tracking on mount (default)
 * function HomeScreen() {
 *   useScreenTracking({ name: 'Home' })
 *   return <View>...</View>
 * }
 *
 * // Manual tracking
 * function DetailsScreen() {
 *   const { trackScreen } = useScreenTracking({
 *     name: 'Details',
 *     trackOnMount: false,
 *   })
 *
 *   useEffect(() => {
 *     if (dataLoaded) {
 *       trackScreen()
 *     }
 *   }, [dataLoaded])
 *
 *   return <View>...</View>
 * }
 * ```
 *
 * @public
 */

export function useScreenTracking({
  name,
  properties = EMPTY_PROPERTIES,
  trackOnMount = true,
}: UseScreenTrackingOptions): UseScreenTrackingReturn {
  const optimization = useOptimization()
  const hasTrackedRef = useRef(false)

  // Store optimization in a ref to prevent unnecessary callback recreations
  const optimizationRef = useRef(optimization)
  optimizationRef.current = optimization

  // Store name and properties in refs to prevent useEffect re-runs
  const nameRef = useRef(name)
  nameRef.current = name

  const propertiesRef = useRef(properties)
  propertiesRef.current = properties

  const trackScreen = useCallback(async (): Promise<OptimizationData | undefined> => {
    const { current: currentName } = nameRef
    const { current: currentProperties } = propertiesRef
    const { current: currentOptimization } = optimizationRef

    logger.info(`Tracking screen: "${currentName}"`)

    try {
      const result = await currentOptimization.screen({
        name: currentName,
        properties: currentProperties,
        screen: { name: currentName },
      })

      hasTrackedRef.current = true
      return result
    } catch (error) {
      logger.error(`Failed to track screen "${currentName}":`, error)
      return undefined
    }
  }, [])

  // Track on mount if enabled
  useEffect(() => {
    if (trackOnMount && !hasTrackedRef.current) {
      void trackScreen()
    }
  }, [trackOnMount, trackScreen])

  // Reset tracking flag when name changes
  useEffect(() => {
    hasTrackedRef.current = false
  }, [name])

  return { trackScreen }
}

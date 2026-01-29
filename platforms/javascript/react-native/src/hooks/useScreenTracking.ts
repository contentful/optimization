import {
  createScopedLogger,
  type OptimizationData,
  type Properties,
} from '@contentful/optimization-core'
import { useCallback, useEffect, useRef } from 'react'
import { useOptimization } from '../context/OptimizationContext'

const logger = createScopedLogger('RN:ScreenTracking')

/**
 * Options for the useScreenTracking hook.
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
   * @default true
   */
  trackOnMount?: boolean
}

/**
 * Return type for the useScreenTracking hook.
 *
 * @public
 */
export interface UseScreenTrackingReturn {
  /**
   * Manually trigger screen tracking.
   * Useful when `trackOnMount` is false or for re-tracking.
   */
  trackScreen: () => Promise<OptimizationData | undefined>
}

const EMPTY_PROPERTIES: Properties = {}

/**
 * Hook for tracking screen views in React Native.
 *
 * By default, tracks the screen automatically when the component mounts.
 * Set `trackOnMount: false` to disable automatic tracking and use the
 * returned `trackScreen` function for manual control.
 *
 * @param options - Screen tracking options
 * @returns Object containing `trackScreen` function for manual triggering
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
 *     trackOnMount: false
 *   })
 *
 *   useEffect(() => {
 *     // Track after data loads
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
      })

      hasTrackedRef.current = true
      return result
    } catch (error) {
      logger.error(
        `Failed to track screen "${currentName}":`,
        error instanceof Error ? error.message : String(error),
      )
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

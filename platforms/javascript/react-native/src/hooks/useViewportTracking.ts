import { createScopedLogger, type SelectedPersonalization } from '@contentful/optimization-core'
import type { Entry } from 'contentful'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions, type LayoutChangeEvent } from 'react-native'
import { useOptimization } from '../context/OptimizationContext'
import { useScrollContext } from '../context/OptimizationScrollContext'

const logger = createScopedLogger('RN:ViewportTracking')

/**
 * Options for the {@link useViewportTracking} hook.
 *
 * @public
 */
export interface UseViewportTrackingOptions {
  /**
   * The resolved Contentful entry to track (baseline or variant).
   */
  entry: Entry

  /**
   * Personalization data for variant tracking. Omit for baseline/non-personalized entries.
   */
  personalization?: SelectedPersonalization

  /**
   * Minimum visibility ratio (0.0 - 1.0) required to consider the component "visible".
   *
   * @defaultValue 0.8
   */
  threshold?: number

  /**
   * Minimum time (in milliseconds) the component must be visible before tracking fires.
   *
   * @defaultValue 2000
   */
  viewTimeMs?: number
}

/**
 * Return value of the {@link useViewportTracking} hook.
 *
 * @public
 */
export interface UseViewportTrackingReturn {
  /** Whether the tracked element is currently visible in the viewport. */
  isVisible: boolean

  /** Layout callback to attach to the tracked View's `onLayout` prop. */
  onLayout: (event: LayoutChangeEvent) => void
}

const PERCENTAGE_MULTIPLIER = 100
const DEFAULT_THRESHOLD = 0.8
const DEFAULT_VIEW_TIME_MS = 2000

/**
 * Extracts tracking metadata from a resolved entry and optional personalization data.
 *
 * @internal
 */
function extractTrackingMetadata(
  resolvedEntry: Entry,
  personalization?: SelectedPersonalization,
): {
  componentId: string
  experienceId?: string
  variantIndex: number
} {
  // If personalization data exists, this is a variant entry
  if (personalization) {
    // Extract componentId from variants object: find the key whose value matches this entry's ID
    const componentId = Object.keys(personalization.variants).find(
      (baselineId) => personalization.variants[baselineId] === resolvedEntry.sys.id,
    )

    // Fallback to entry.sys.id if variants mapping not found (shouldn't happen, but defensive)
    return {
      componentId: componentId ?? resolvedEntry.sys.id,
      experienceId: personalization.experienceId,
      variantIndex: personalization.variantIndex,
    }
  }

  // Baseline or non-personalized entry: no personalization, use entry.sys.id as componentId
  return {
    componentId: resolvedEntry.sys.id,
    experienceId: undefined,
    variantIndex: 0,
  }
}

/**
 * Tracks whether a component is visible in the viewport and fires a component view
 * event when visibility and time thresholds are met.
 *
 * @param options - Tracking options including the entry, thresholds, and personalization data
 * @returns An object with `isVisible` state and an `onLayout` callback for the tracked View
 *
 * @throws Error if called outside of an {@link OptimizationProvider}
 *
 * @remarks
 * Uses {@link useScrollContext} if available, otherwise falls back to screen dimensions.
 * The hook tracks only once per component instance — subsequent visibility events are ignored.
 *
 * @example
 * ```tsx
 * function TrackedEntry({ entry }: { entry: Entry }) {
 *   const { onLayout, isVisible } = useViewportTracking({
 *     entry,
 *     threshold: 0.8,
 *     viewTimeMs: 2000,
 *   })
 *
 *   return (
 *     <View onLayout={onLayout}>
 *       <Text>{isVisible ? 'Visible' : 'Hidden'}</Text>
 *     </View>
 *   )
 * }
 * ```
 *
 * @public
 */
export function useViewportTracking({
  entry,
  personalization,
  threshold = DEFAULT_THRESHOLD,
  viewTimeMs = DEFAULT_VIEW_TIME_MS,
}: UseViewportTrackingOptions): UseViewportTrackingReturn {
  const optimization = useOptimization()
  // We invoke useScrollContext here to check if the OptimizationScrollProvider is mounted and the scroll context is available.
  const scrollContext = useScrollContext()

  // Extract tracking metadata from the entry and personalization data
  const { componentId, experienceId, variantIndex } = extractTrackingMetadata(
    entry,
    personalization,
  )

  // Fallback to screen dimensions when used outside OptimizationScrollProvider
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height)

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenHeight(window.height)
    })
    return () => {
      subscription.remove()
    }
  }, [])

  // Use scroll context if available, otherwise use screen dimensions

  const scrollY = scrollContext ? scrollContext.scrollY : 0

  const viewportHeight = scrollContext ? scrollContext.viewportHeight : screenHeight

  const dimensionsRef = useRef<{ y: number; height: number } | null>(null)
  const isVisibleRef = useRef(false)
  const viewTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Store optimization in a ref to prevent unnecessary callback recreations
  const optimizationRef = useRef(optimization)
  optimizationRef.current = optimization

  logger.debug(
    `Hook initialized for ${componentId} (experienceId: ${experienceId}, variantIndex: ${variantIndex})`,
  )

  // Log if hook is being re-created (potential React Strict Mode or unmount/remount issue)
  useEffect(() => {
    logger.debug(`Hook mounted/updated for ${componentId}`)
    return () => {
      logger.debug(`Hook unmounting for ${componentId}`)
    }
  }, [])

  const startTrackingTimer = useCallback(
    (visibilityPercent: number) => {
      logger.info(
        `Component ${componentId} became visible (${visibilityPercent.toFixed(1)}%), starting ${viewTimeMs}ms timer`,
      )

      // Clear any existing timeout
      if (viewTimeoutRef.current) {
        logger.debug(`Clearing existing timer for ${componentId}`)
        clearTimeout(viewTimeoutRef.current)
      }

      viewTimeoutRef.current = setTimeout(() => {
        const { current: isVisible } = isVisibleRef

        logger.debug(`Timer fired for ${componentId} - isVisible: ${isVisible}`)

        if (isVisible) {
          logger.info(`Component ${componentId} visible for ${viewTimeMs}ms, initiating tracking`)

          // Use ref to get current optimization instance
          const { current: currentOptimization } = optimizationRef

          // Track the component view
          void (async () => {
            await currentOptimization.analytics.trackComponentView({
              componentId,
              experienceId,
              variantIndex,
            })
          })()
        } else {
          logger.debug(`Skipping track for ${componentId} - component no longer visible`)
        }
      }, viewTimeMs)
    },
    [componentId, experienceId, variantIndex, viewTimeMs],
  )

  const canCheckVisibility = useCallback((): boolean => {
    const { current: dimensions } = dimensionsRef
    if (!dimensions) {
      logger.debug(`${componentId} has no dimensions yet`)
      return false
    }

    if (viewportHeight === 0) {
      const context = scrollContext
        ? '(waiting for ScrollView layout)'
        : '(waiting for screen dimensions)'
      logger.debug(`${componentId} viewport height is 0 ${context}`)
      return false
    }

    return true
  }, [componentId, viewportHeight, scrollContext])

  const checkVisibility = useCallback(() => {
    logger.debug(`checkVisibility called for ${componentId}`)

    if (!canCheckVisibility()) {
      return
    }

    const { current: dimensions } = dimensionsRef
    if (!dimensions) {
      return
    }

    const { y: elementY, height: elementHeight } = dimensions
    const elementBottom = elementY + elementHeight

    // Calculate what portion of the element is visible in the viewport
    const viewportTop = scrollY
    const viewportBottom = scrollY + viewportHeight

    // Calculate the intersection between element and viewport
    const visibleTop = Math.max(elementY, viewportTop)
    const visibleBottom = Math.min(elementBottom, viewportBottom)
    const visibleHeight = Math.max(0, visibleBottom - visibleTop)
    const visibilityRatio = visibleHeight / elementHeight

    const contextType = scrollContext ? '(ScrollView)' : '(non-scrollable)'
    logger.debug(
      `${componentId} visibility check ${contextType}:
  Element: y=${elementY.toFixed(0)}, bottom=${elementBottom.toFixed(0)}
  Viewport: scrollY=${scrollY.toFixed(0)}, height=${viewportHeight.toFixed(0)}, top=${viewportTop.toFixed(0)}, bottom=${viewportBottom.toFixed(0)}
  Visible: height=${visibleHeight.toFixed(0)}, ratio=${visibilityRatio.toFixed(2)}, threshold=${threshold}`,
    )

    const isNowVisible = visibilityRatio >= threshold
    const { current: wasVisible } = isVisibleRef
    isVisibleRef.current = isNowVisible

    if (isNowVisible && !wasVisible) {
      logger.info(`${componentId} transitioned from invisible to visible`)
      startTrackingTimer(visibilityRatio * PERCENTAGE_MULTIPLIER)
    } else if (!isNowVisible && wasVisible) {
      logger.info(
        `${componentId} became invisible (${(visibilityRatio * PERCENTAGE_MULTIPLIER).toFixed(1)}%), canceling timer`,
      )

      if (viewTimeoutRef.current) {
        clearTimeout(viewTimeoutRef.current)
        viewTimeoutRef.current = null
      }
    } else if (!isNowVisible) {
      logger.debug(
        `${componentId} is not visible enough (${(visibilityRatio * PERCENTAGE_MULTIPLIER).toFixed(1)}%)`,
      )
    } else {
      logger.debug(
        `${componentId} remains visible (${(visibilityRatio * PERCENTAGE_MULTIPLIER).toFixed(1)}%)`,
      )
    }
  }, [
    canCheckVisibility,
    componentId,
    threshold,
    scrollY,
    viewportHeight,
    startTrackingTimer,
    scrollContext,
  ])

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const {
        nativeEvent: {
          layout: { y, height },
        },
      } = event
      logger.debug(
        `Layout for ${componentId}: y=${y}, height=${height} (position within ScrollView content)`,
      )
      dimensionsRef.current = { y, height }

      // Check visibility immediately after layout is captured
      // This ensures tracking works even if user never scrolls
      checkVisibility()
    },
    [componentId, checkVisibility],
  )

  // Check visibility when scroll position or viewport changes
  useEffect(() => {
    checkVisibility()
  }, [scrollY, viewportHeight, checkVisibility])

  // Cleanup timeout on unmount
  useEffect(
    () => () => {
      if (viewTimeoutRef.current) {
        clearTimeout(viewTimeoutRef.current)
      }
    },
    [],
  )

  return {
    isVisible: isVisibleRef.current,
    onLayout: handleLayout,
  }
}

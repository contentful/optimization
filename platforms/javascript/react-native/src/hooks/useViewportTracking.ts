import { logger } from '@contentful/optimization-core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions, type LayoutChangeEvent } from 'react-native'
import { useOptimization } from '../context/OptimizationContext'
import { useScrollContext } from '../context/ScrollContext'

export interface UseViewportTrackingOptions {
  componentId: string
  experienceId?: string
  variantIndex: number
  /**
   * Minimum visibility ratio (0.0 - 1.0) required to consider component "visible".
   * Default: 0.8 (80% of the component must be visible in viewport)
   */
  threshold?: number
  /**
   * Minimum time (in milliseconds) the component must be visible before tracking fires.
   * Default: 2000ms (2 seconds)
   */
  viewTimeMs?: number
}

export interface UseViewportTrackingReturn {
  isVisible: boolean
  onLayout: (event: LayoutChangeEvent) => void
}

const PERCENTAGE_MULTIPLIER = 100
const DEFAULT_THRESHOLD = 0.8
const DEFAULT_VIEW_TIME_MS = 2000

export function useViewportTracking({
  componentId,
  experienceId,
  variantIndex,
  threshold = DEFAULT_THRESHOLD,
  viewTimeMs = DEFAULT_VIEW_TIME_MS,
}: UseViewportTrackingOptions): UseViewportTrackingReturn {
  const optimization = useOptimization()
  // We invoke useScrollContext here to check if the ScrollProvider is mounted and the scroll context is available.
  const scrollContext = useScrollContext()

  // Fallback to screen dimensions when used outside ScrollProvider
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
    `[ViewportTracking] Hook initialized for ${componentId} (experienceId: ${experienceId}, variantIndex: ${variantIndex})`,
  )

  // Log if hook is being re-created (potential React Strict Mode or unmount/remount issue)
  useEffect(() => {
    logger.debug(`[ViewportTracking] Hook mounted/updated for ${componentId}`)
    return () => {
      logger.debug(`[ViewportTracking] Hook unmounting for ${componentId}`)
    }
  }, [])

  const startTrackingTimer = useCallback(
    (visibilityPercent: number) => {
      logger.info(
        `[ViewportTracking] Component ${componentId} became visible (${visibilityPercent.toFixed(1)}%), starting ${viewTimeMs}ms timer`,
      )

      // Clear any existing timeout
      if (viewTimeoutRef.current) {
        logger.debug(`[ViewportTracking] Clearing existing timer for ${componentId}`)
        clearTimeout(viewTimeoutRef.current)
      }

      viewTimeoutRef.current = setTimeout(() => {
        const { current: isVisible } = isVisibleRef

        logger.debug(`[ViewportTracking] Timer fired for ${componentId} - isVisible: ${isVisible}`)

        if (isVisible) {
          logger.info(
            `[ViewportTracking] Component ${componentId} visible for ${viewTimeMs}ms, initiating tracking`,
          )

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
          logger.debug(
            `[ViewportTracking] Skipping track for ${componentId} - component no longer visible`,
          )
        }
      }, viewTimeMs)
    },
    [componentId, experienceId, variantIndex, viewTimeMs],
  )

  const canCheckVisibility = useCallback((): boolean => {
    const { current: dimensions } = dimensionsRef
    if (!dimensions) {
      logger.debug(`[ViewportTracking] ${componentId} has no dimensions yet`)
      return false
    }

    if (viewportHeight === 0) {
      const context = scrollContext
        ? '(waiting for ScrollView layout)'
        : '(waiting for screen dimensions)'
      logger.debug(`[ViewportTracking] ${componentId} viewport height is 0 ${context}`)
      return false
    }

    return true
  }, [componentId, viewportHeight, scrollContext])

  const checkVisibility = useCallback(() => {
    logger.debug(`[ViewportTracking] checkVisibility called for ${componentId}`)

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
      `[ViewportTracking] ${componentId} visibility check ${contextType}:
  Element: y=${elementY.toFixed(0)}, bottom=${elementBottom.toFixed(0)}
  Viewport: scrollY=${scrollY.toFixed(0)}, height=${viewportHeight.toFixed(0)}, top=${viewportTop.toFixed(0)}, bottom=${viewportBottom.toFixed(0)}
  Visible: height=${visibleHeight.toFixed(0)}, ratio=${visibilityRatio.toFixed(2)}, threshold=${threshold}`,
    )

    const isNowVisible = visibilityRatio >= threshold
    const { current: wasVisible } = isVisibleRef
    isVisibleRef.current = isNowVisible

    if (isNowVisible && !wasVisible) {
      logger.info(`[ViewportTracking] ${componentId} transitioned from invisible to visible`)
      startTrackingTimer(visibilityRatio * PERCENTAGE_MULTIPLIER)
    } else if (!isNowVisible && wasVisible) {
      logger.info(
        `[ViewportTracking] ${componentId} became invisible (${(visibilityRatio * PERCENTAGE_MULTIPLIER).toFixed(1)}%), canceling timer`,
      )

      if (viewTimeoutRef.current) {
        clearTimeout(viewTimeoutRef.current)
        viewTimeoutRef.current = null
      }
    } else if (!isNowVisible) {
      logger.debug(
        `[ViewportTracking] ${componentId} is not visible enough (${(visibilityRatio * PERCENTAGE_MULTIPLIER).toFixed(1)}%)`,
      )
    } else {
      logger.debug(
        `[ViewportTracking] ${componentId} remains visible (${(visibilityRatio * PERCENTAGE_MULTIPLIER).toFixed(1)}%)`,
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
        `[ViewportTracking] Layout for ${componentId}: y=${y}, height=${height} (position within ScrollView content)`,
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

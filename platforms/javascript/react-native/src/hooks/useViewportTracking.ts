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
    if (!scrollContext) {
      const subscription = Dimensions.addEventListener('change', ({ window }) => {
        setScreenHeight(window.height)
      })
      return () => {
        subscription.remove()
      }
    }
  }, [scrollContext])

  // Use scroll context if available, otherwise use screen dimensions
  const scrollY = scrollContext?.scrollY ?? 0
  const viewportHeight = scrollContext?.viewportHeight ?? screenHeight

  const hasTrackedRef = useRef(false)
  const dimensionsRef = useRef<{ y: number; height: number } | null>(null)
  const isVisibleRef = useRef(false)
  const viewTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const startTrackingTimer = useCallback(
    (visibilityPercent: number) => {
      logger.info(
        `[ViewportTracking] Component ${componentId} became visible (${visibilityPercent.toFixed(1)}%), starting ${viewTimeMs}ms timer`,
      )

      // Clear any existing timeout
      if (viewTimeoutRef.current) {
        clearTimeout(viewTimeoutRef.current)
      }

      viewTimeoutRef.current = setTimeout(() => {
        const { current: isVisible } = isVisibleRef
        const { current: hasTracked } = hasTrackedRef

        if (isVisible && !hasTracked) {
          hasTrackedRef.current = true

          logger.info(
            `[ViewportTracking] Component ${componentId} visible for ${viewTimeMs}ms, tracking view`,
          )

          // Track the component view
          optimization.analytics
            .trackComponentView({
              componentId,
              experienceId,
              variantIndex,
            })
            .then(() => {
              logger.info(`[ViewportTracking] Successfully tracked ${componentId}`)
            })
            .catch((error: unknown) => {
              logger.error(
                `[ViewportTracking] Failed to track component view for ${componentId}:`,
                error,
              )
            })
        }
      }, viewTimeMs)
    },
    [componentId, experienceId, variantIndex, viewTimeMs, optimization],
  )

  const canCheckVisibility = useCallback((): boolean => {
    if (hasTrackedRef.current) {
      logger.debug(`[ViewportTracking] ${componentId} already tracked, skipping`)
      return false
    }

    const { current: dimensions } = dimensionsRef
    if (!dimensions) {
      logger.debug(`[ViewportTracking] ${componentId} has no dimensions yet`)
      return false
    }

    if (viewportHeight === 0) {
      logger.debug(
        `[ViewportTracking] ${componentId} viewport height is 0 ${scrollContext ? '(waiting for ScrollView layout)' : '(waiting for screen dimensions)'}`,
      )
      return false
    }

    return true
  }, [componentId, viewportHeight, scrollContext])

  const checkVisibility = useCallback(() => {
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

    logger.debug(
      `[ViewportTracking] ${componentId} visibility check ${scrollContext ? '(ScrollView)' : '(non-scrollable)'}:
  Element: y=${elementY.toFixed(0)}, bottom=${elementBottom.toFixed(0)}
  Viewport: scrollY=${scrollY.toFixed(0)}, height=${viewportHeight.toFixed(0)}, top=${viewportTop.toFixed(0)}, bottom=${viewportBottom.toFixed(0)}
  Visible: height=${visibleHeight.toFixed(0)}, ratio=${visibilityRatio.toFixed(2)}, threshold=${threshold}`,
    )

    const isNowVisible = visibilityRatio >= threshold
    const { current: wasVisible } = isVisibleRef
    isVisibleRef.current = isNowVisible

    if (isNowVisible && !wasVisible) {
      startTrackingTimer(visibilityRatio * PERCENTAGE_MULTIPLIER)
    } else if (!isNowVisible && wasVisible) {
      logger.debug(
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
    }
  }, [canCheckVisibility, componentId, threshold, scrollY, viewportHeight, startTrackingTimer])

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

import { logger } from '@contentful/optimization-core'
import { useCallback, useEffect, useRef } from 'react'
import type { LayoutChangeEvent } from 'react-native'
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
  const { scrollY, viewportHeight } = useScrollContext()

  const hasTrackedRef = useRef(false)
  const dimensionsRef = useRef<{ y: number; height: number } | null>(null)
  const isVisibleRef = useRef(false)
  const viewTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
    },
    [componentId],
  )

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

  const checkVisibility = useCallback(() => {
    const { current: dimensions } = dimensionsRef

    if (hasTrackedRef.current) {
      logger.debug(`[ViewportTracking] ${componentId} already tracked, skipping`)
      return
    }

    if (!dimensions) {
      logger.debug(`[ViewportTracking] ${componentId} has no dimensions yet`)
      return
    }

    if (viewportHeight === 0) {
      logger.debug(`[ViewportTracking] ${componentId} viewport height is 0`)
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
      `[ViewportTracking] ${componentId} visibility check: elementY=${elementY.toFixed(0)}, elementBottom=${elementBottom.toFixed(0)}, scrollY=${scrollY.toFixed(0)}, viewportHeight=${viewportHeight.toFixed(0)}, viewportTop=${viewportTop.toFixed(0)}, viewportBottom=${viewportBottom.toFixed(0)}, visibleHeight=${visibleHeight.toFixed(0)}, ratio=${visibilityRatio.toFixed(2)}, threshold=${threshold}`,
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
  }, [componentId, threshold, scrollY, viewportHeight, startTrackingTimer])

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

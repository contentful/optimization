import { logger } from '@contentful/optimization-core'
import { useCallback, useEffect, useRef } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { useOptimization } from '../context/OptimizationContext'
import { useScrollContext } from '../context/ScrollContext'

export interface UseViewportTrackingOptions {
  componentId: string
  experienceId?: string
  variantIndex: number
  threshold?: number
}

export interface UseViewportTrackingReturn {
  isVisible: boolean
  onLayout: (event: LayoutChangeEvent) => void
}

const PERCENTAGE_MULTIPLIER = 100

export function useViewportTracking({
  componentId,
  experienceId,
  variantIndex,
  threshold = 1.0,
}: UseViewportTrackingOptions): UseViewportTrackingReturn {
  const optimization = useOptimization()
  const { scrollY, viewportHeight } = useScrollContext()

  const hasTrackedRef = useRef(false)
  const dimensionsRef = useRef<{ y: number; height: number } | null>(null)
  const isVisibleRef = useRef(false)

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

    // Element's position within the ScrollView content
    const { y: elementY, height: elementHeight } = dimensions
    const elementBottom = elementY + elementHeight

    // Calculate what portion of the element is visible in the viewport
    // The viewport shows content from scrollY to scrollY + viewportHeight
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

    isVisibleRef.current = isNowVisible

    if (isNowVisible) {
      hasTrackedRef.current = true

      logger.info(`[ViewportTracking] Component ${componentId} is fully visible, tracking view`)

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
    } else {
      logger.debug(
        `[ViewportTracking] ${componentId} is not visible enough (${(visibilityRatio * PERCENTAGE_MULTIPLIER).toFixed(1)}%)`,
      )
    }
  }, [componentId, experienceId, variantIndex, threshold, scrollY, viewportHeight, optimization])

  // Check visibility when scroll position or viewport changes
  useEffect(() => {
    checkVisibility()
  }, [scrollY, viewportHeight, checkVisibility])

  return {
    isVisible: isVisibleRef.current,
    onLayout: handleLayout,
  }
}

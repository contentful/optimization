import { logger } from '@contentful/optimization-core'
import { useCallback, useEffect, useRef } from 'react'
import { findNodeHandle, type View } from 'react-native'
import { useOptimization } from '../context/OptimizationContext'
import { useScrollContext } from '../context/ScrollContext'

export interface UseViewportTrackingOptions {
  componentId: string
  experienceId?: string
  variantIndex: number
  threshold?: number
}

export interface UseViewportTrackingReturn {
  ref: React.RefObject<View>
  isVisible: boolean
  onLayout: () => void
}

export function useViewportTracking({
  componentId,
  experienceId,
  variantIndex,
  threshold = 1.0,
}: UseViewportTrackingOptions): UseViewportTrackingReturn {
  const optimization = useOptimization()
  const { scrollY, viewportHeight } = useScrollContext()

  const viewRef = useRef<View>(null)
  const hasTrackedRef = useRef(false)
  const dimensionsRef = useRef<{ top: number; height: number } | null>(null)
  const isVisibleRef = useRef(false)

  const measureView = useCallback(() => {
    if (!viewRef.current) return

    const handle = findNodeHandle(viewRef.current)
    if (!handle) return

    viewRef.current.measureInWindow((_x, y, _width, height) => {
      if (height > 0) {
        dimensionsRef.current = { top: y, height }
        logger.debug(
          `[ViewportTracking] Measured component ${componentId}: top=${y}, height=${height}`,
        )
      }
    })
  }, [componentId])

  const checkVisibility = useCallback(() => {
    const { current: dimensions } = dimensionsRef

    if (hasTrackedRef.current || !dimensions || viewportHeight === 0) {
      return
    }

    const { top: elementTop, height: elementHeight } = dimensions
    const elementBottom = elementTop + elementHeight

    // Calculate visibility based on threshold
    // For threshold = 1.0 (fully visible), the element must be completely within viewport
    const visibleTop = Math.max(elementTop, 0)
    const visibleBottom = Math.min(elementBottom, viewportHeight)
    const visibleHeight = Math.max(0, visibleBottom - visibleTop)
    const visibilityRatio = visibleHeight / elementHeight

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
        .catch((error: unknown) => {
          logger.error(
            `[ViewportTracking] Failed to track component view for ${componentId}:`,
            error,
          )
        })
    }
  }, [componentId, experienceId, variantIndex, threshold, viewportHeight, optimization])

  // Measure on layout changes
  const handleLayout = useCallback(() => {
    measureView()
  }, [measureView])

  // Check visibility when scroll position or viewport changes
  useEffect(() => {
    checkVisibility()
  }, [scrollY, viewportHeight, checkVisibility])

  return {
    ref: viewRef,
    isVisible: isVisibleRef.current,
    onLayout: handleLayout,
  }
}

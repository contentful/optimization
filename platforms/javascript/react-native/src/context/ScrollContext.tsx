import { logger } from '@contentful/optimization-core'
import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  ScrollView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native'

interface ScrollContextValue {
  scrollY: number
  viewportHeight: number
}

const ScrollContext = createContext<ScrollContextValue | null>(null)

const SCROLL_LOG_THRESHOLD = 50

export function useScrollContext(): ScrollContextValue | null {
  const context = useContext(ScrollContext)
  return context
}

export interface ScrollProviderProps extends ScrollViewProps {
  children: ReactNode
}

export function ScrollProvider({
  children,
  onScroll,
  onLayout,
  ...scrollViewProps
}: ScrollProviderProps): React.JSX.Element {
  const [scrollY, setScrollY] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const {
        nativeEvent: {
          layout: { height },
        },
      } = event

      // Capture viewport height on initial layout
      // This ensures tracking works even before first scroll
      if (viewportHeight === 0) {
        logger.debug(`[ScrollProvider] Initial layout: viewport=${height.toFixed(0)}`)
        setViewportHeight(height)
      }

      // Call the user's onLayout handler if provided
      if (onLayout) {
        onLayout(event)
      }
    },
    [onLayout, viewportHeight],
  )

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { nativeEvent } = event
      const { contentOffset, layoutMeasurement } = nativeEvent
      const { y: scrollYValue } = contentOffset
      const { height: viewportHeightValue } = layoutMeasurement

      // Only log on significant changes to avoid spam
      if (Math.abs(scrollYValue - scrollY) > SCROLL_LOG_THRESHOLD || viewportHeight === 0) {
        logger.debug(
          `[ScrollProvider] Scroll: y=${scrollYValue.toFixed(0)}, viewport=${viewportHeightValue.toFixed(0)}`,
        )
      }

      setScrollY(scrollYValue)
      setViewportHeight(viewportHeightValue)

      // Call the user's onScroll handler if provided
      if (onScroll) {
        onScroll(event)
      }
    },
    [onScroll, scrollY, viewportHeight],
  )

  const contextValue: ScrollContextValue = {
    scrollY,
    viewportHeight,
  }

  return (
    <ScrollContext.Provider value={contextValue}>
      <ScrollView
        {...scrollViewProps}
        onLayout={handleLayout}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
    </ScrollContext.Provider>
  )
}

export default ScrollContext

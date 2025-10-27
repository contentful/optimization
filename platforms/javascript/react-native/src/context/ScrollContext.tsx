import { logger } from '@contentful/optimization-core'
import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  ScrollView,
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

export function useScrollContext(): ScrollContextValue {
  const context = useContext(ScrollContext)

  if (!context) {
    throw new Error(
      'useScrollContext must be used within a ScrollProvider. ' +
        'Make sure to wrap your ScrollView with <ScrollProvider>.',
    )
  }

  return context
}

export interface ScrollProviderProps extends ScrollViewProps {
  children: ReactNode
}

export function ScrollProvider({
  children,
  onScroll,
  ...scrollViewProps
}: ScrollProviderProps): React.JSX.Element {
  const [scrollY, setScrollY] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

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
      <ScrollView {...scrollViewProps} onScroll={handleScroll} scrollEventThrottle={16}>
        {children}
      </ScrollView>
    </ScrollContext.Provider>
  )
}

export default ScrollContext

import { createScopedLogger } from '@contentful/optimization-core/logger'
import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  ScrollView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native'

const logger = createScopedLogger('RN:Scroll')

/**
 * @internal
 */
interface ScrollContextValue {
  scrollY: number
  viewportHeight: number
}

const ScrollContext = createContext<ScrollContextValue | null>(null)

const SCROLL_LOG_THRESHOLD = 50

/**
 * Returns the current scroll position and viewport height from the nearest {@link OptimizationScrollProvider}.
 *
 * @returns The scroll context value, or `null` if not within a {@link OptimizationScrollProvider}
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const scroll = useScrollContext()
 *   return <Text>Scroll Y: {scroll?.scrollY ?? 0}</Text>
 * }
 * ```
 *
 * @public
 */
export function useScrollContext(): ScrollContextValue | null {
  const context = useContext(ScrollContext)
  return context
}

/**
 * Props for the {@link OptimizationScrollProvider} component. Extends React Native's `ScrollViewProps`.
 *
 * @public
 */
export interface OptimizationScrollProviderProps extends ScrollViewProps {
  children: ReactNode
}

/**
 * Wraps a `ScrollView` and provides scroll position context to child components
 * for viewport-based tracking.
 *
 * @param props - ScrollView props plus children
 * @returns A `ScrollView` wrapped in a scroll context provider
 *
 * @remarks
 * When {@link Personalization} or {@link Analytics} components are placed inside a
 * `OptimizationScrollProvider`, they use the actual scroll position for visibility calculations.
 * Without a `OptimizationScrollProvider`, they fall back to screen dimensions.
 *
 * @example
 * ```tsx
 * <OptimizationScrollProvider>
 *   <Personalization baselineEntry={entry}>
 *     {(resolved) => <HeroComponent data={resolved} />}
 *   </Personalization>
 * </OptimizationScrollProvider>
 * ```
 *
 * @public
 */
export function OptimizationScrollProvider({
  children,
  onScroll,
  onLayout,
  ...scrollViewProps
}: OptimizationScrollProviderProps): React.JSX.Element {
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
        logger.debug(`Initial layout: viewport=${height.toFixed(0)}`)
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
          `Scroll: y=${scrollYValue.toFixed(0)}, viewport=${viewportHeightValue.toFixed(0)}`,
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

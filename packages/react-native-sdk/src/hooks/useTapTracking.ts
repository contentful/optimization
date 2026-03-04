import type { SelectedPersonalization } from '@contentful/optimization-core/api-schemas'
import { createScopedLogger } from '@contentful/optimization-core/logger'
import type { Entry } from 'contentful'
import { useCallback, useRef } from 'react'
import type { GestureResponderEvent } from 'react-native'
import { useOptimization } from '../context/OptimizationContext'
import { extractTrackingMetadata } from './useViewportTracking'

const logger = createScopedLogger('RN:TapTracking')

/**
 * Maximum distance (in points) a touch can move between start and end
 * and still be classified as a tap rather than a scroll or drag gesture.
 *
 * @internal
 */
const TAP_DISTANCE_THRESHOLD = 10

/**
 * Options for the {@link useTapTracking} hook.
 *
 * @public
 */
export interface UseTapTrackingOptions {
  /**
   * The resolved Contentful entry to track (baseline or variant).
   */
  entry: Entry

  /**
   * Personalization data for variant tracking. Omit for baseline/non-personalized entries.
   */
  personalization?: SelectedPersonalization

  /**
   * Whether tap tracking is enabled for this component.
   */
  enabled: boolean

  /**
   * Optional callback invoked after the tap event is tracked.
   * When `true`, taps are tracked without a callback.
   * When a function, it is called with the entry after the tracking event is emitted.
   *
   * @defaultValue `undefined`
   */
  onTap?: boolean | ((entry: Entry) => void)
}

/**
 * Return value of the {@link useTapTracking} hook.
 *
 * @public
 */
export interface UseTapTrackingReturn {
  /** Touch start handler to attach to a View. `undefined` when tracking is disabled. */
  onTouchStart: ((e: GestureResponderEvent) => void) | undefined

  /** Touch end handler to attach to a View. `undefined` when tracking is disabled. */
  onTouchEnd: ((e: GestureResponderEvent) => void) | undefined
}

/**
 * Detects taps on a View via raw touch events and emits `component_click`
 * analytics events through the existing Insights pipeline.
 *
 * @param options - Tracking options including the entry, personalization data, and enabled state.
 * @returns {@link UseTapTrackingReturn} with touch handlers to spread onto a View,
 *   or `undefined` handlers when tracking is disabled.
 *
 * @throws If called outside of an {@link OptimizationProvider}.
 *
 * @remarks
 * Uses `onTouchStart`/`onTouchEnd` rather than wrapping children in a
 * `Pressable`, so taps are captured even when a child `Pressable` handles
 * the gesture. A touch is classified as a tap only when the finger moves
 * less than {@link TAP_DISTANCE_THRESHOLD} points between start and end.
 *
 * @example
 * ```tsx
 * function TrackedEntry({ entry }: { entry: Entry }) {
 *   const { onTouchStart, onTouchEnd } = useTapTracking({
 *     entry,
 *     enabled: true,
 *   })
 *
 *   return (
 *     <View onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
 *       <Text>{entry.fields.title}</Text>
 *     </View>
 *   )
 * }
 * ```
 *
 * @public
 */
export function useTapTracking({
  entry,
  personalization,
  enabled,
  onTap,
}: UseTapTrackingOptions): UseTapTrackingReturn {
  const optimization = useOptimization()
  const optimizationRef = useRef(optimization)
  optimizationRef.current = optimization

  const touchStartRef = useRef<{ pageX: number; pageY: number } | null>(null)

  const { componentId, experienceId, variantIndex } = extractTrackingMetadata(
    entry,
    personalization,
  )

  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    const {
      nativeEvent: { pageX, pageY },
    } = e
    touchStartRef.current = { pageX, pageY }
  }, [])

  const handleTouchEnd = useCallback(
    (e: GestureResponderEvent) => {
      const { current: start } = touchStartRef
      if (!start) return

      const {
        nativeEvent: { pageX, pageY },
      } = e
      const distance = Math.sqrt((pageX - start.pageX) ** 2 + (pageY - start.pageY) ** 2)

      touchStartRef.current = null

      if (distance >= TAP_DISTANCE_THRESHOLD) return

      logger.info(`Tap detected on ${componentId}, emitting component_click`)

      void optimizationRef.current.trackComponentClick({
        componentId,
        experienceId,
        variantIndex,
      })

      if (typeof onTap === 'function') {
        onTap(entry)
      }
    },
    [componentId, experienceId, variantIndex, entry, onTap],
  )

  if (!enabled) {
    return { onTouchStart: undefined, onTouchEnd: undefined }
  }

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  }
}

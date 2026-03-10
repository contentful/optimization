import type { SelectedPersonalization } from '@contentful/optimization-core/api-schemas'
import { createScopedLogger } from '@contentful/optimization-core/logger'
import type { Entry } from 'contentful'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Dimensions, type LayoutChangeEvent } from 'react-native'
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
   * Minimum accumulated visible time (in milliseconds) before the first tracking event fires.
   *
   * @defaultValue 2000
   */
  viewTimeMs?: number

  /**
   * Whether view tracking is enabled for this component.
   * When `false`, the hook returns a no-op `onLayout` and `isVisible: false`
   * without setting up timers or scroll listeners.
   *
   * @defaultValue `true`
   */
  enabled?: boolean

  /**
   * Interval (in milliseconds) between periodic view duration update events
   * after the initial event has fired.
   *
   * @defaultValue 5000
   */
  viewDurationUpdateIntervalMs?: number
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
const DEFAULT_VIEW_DURATION_UPDATE_INTERVAL_MS = 5000
const HEX_RADIX = 16
const createViewId = (): string => {
  try {
    return globalThis.crypto.randomUUID()
  } catch {
    return `rn-${Date.now()}-${Math.random().toString(HEX_RADIX).slice(2)}`
  }
}

/**
 * Mutable state for a single visibility cycle. Stored in a ref to avoid
 * triggering re-renders on every scroll tick.
 */
interface ViewCycleState {
  viewId: string | null
  visibleSince: number | null
  accumulatedMs: number
  attempts: number
}

const createInitialCycleState = (): ViewCycleState => ({
  viewId: null,
  visibleSince: null,
  accumulatedMs: 0,
  attempts: 0,
})

/**
 * Flush elapsed visible time into accumulatedMs and reset visibleSince to `now`.
 * Returns the updated accumulatedMs.
 */
function flushAccumulatedTime(cycle: ViewCycleState, now: number): number {
  if (cycle.visibleSince !== null) {
    cycle.accumulatedMs += now - cycle.visibleSince
    cycle.visibleSince = now
  }
  return cycle.accumulatedMs
}

/**
 * Pause time accumulation without resetting the cycle.
 */
function pauseAccumulation(cycle: ViewCycleState, now: number): void {
  if (cycle.visibleSince !== null) {
    cycle.accumulatedMs += now - cycle.visibleSince
    cycle.visibleSince = null
  }
}

function resetCycleState(cycle: ViewCycleState): void {
  cycle.viewId = null
  cycle.visibleSince = null
  cycle.accumulatedMs = 0
  cycle.attempts = 0
}

/**
 * Extracts tracking metadata from a resolved entry and optional personalization data.
 *
 * @param resolvedEntry - The resolved Contentful entry (baseline or variant).
 * @param personalization - Optional personalization selection for variant tracking.
 * @returns An object containing `componentId`, optional `experienceId`, and `variantIndex`.
 *
 * @internal
 */
export function extractTrackingMetadata(
  resolvedEntry: Entry,
  personalization?: SelectedPersonalization,
): {
  componentId: string
  experienceId?: string
  variantIndex: number
} {
  if (personalization) {
    const componentId = Object.keys(personalization.variants).find(
      (baselineId) => personalization.variants[baselineId] === resolvedEntry.sys.id,
    )

    return {
      componentId: componentId ?? resolvedEntry.sys.id,
      experienceId: personalization.experienceId,
      variantIndex: personalization.variantIndex,
    }
  }

  return {
    componentId: resolvedEntry.sys.id,
    experienceId: undefined,
    variantIndex: 0,
  }
}

/**
 * Compute remaining ms until the next event should fire, based on accumulated
 * visible time and the number of events already emitted.
 *
 * Formula mirrors Web SDK `ElementViewObserver.getRemainingMsUntilNextFire`:
 *   requiredMs = dwellTimeMs + attempts * viewDurationUpdateIntervalMs
 *   remaining  = requiredMs - accumulatedMs
 */
function getRemainingMsUntilNextFire(
  cycle: ViewCycleState,
  dwellTimeMs: number,
  updateIntervalMs: number,
): number {
  const requiredMs = dwellTimeMs + cycle.attempts * updateIntervalMs
  return requiredMs - cycle.accumulatedMs
}

/**
 * Tracks whether a component is visible in the viewport and fires component view
 * events with accumulated duration tracking.
 *
 * The hook implements a three-phase event lifecycle per visibility cycle:
 * 1. **Initial event** after accumulated visible time reaches `viewTimeMs`.
 * 2. **Periodic updates** every `viewDurationUpdateIntervalMs` while visible.
 * 3. **Final event** when visibility ends (only if at least one event was already emitted).
 *
 * @param options - {@link UseViewportTrackingOptions} including the entry, thresholds, and personalization data.
 * @returns An object with `isVisible` state and an `onLayout` callback for the tracked View
 *
 * @throws Error if called outside of an {@link OptimizationProvider}
 *
 * @remarks
 * Uses {@link useScrollContext} if available, otherwise falls back to screen dimensions.
 * A new visibility cycle (with a fresh `viewId`) starts each time the component
 * transitions from invisible to visible. Time accumulation pauses when the app moves
 * to the background.
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
  enabled = true,
  viewDurationUpdateIntervalMs = DEFAULT_VIEW_DURATION_UPDATE_INTERVAL_MS,
}: UseViewportTrackingOptions): UseViewportTrackingReturn {
  const contentfulOptimization = useOptimization()

  const scrollContext = useScrollContext()

  const { componentId, experienceId, variantIndex } = extractTrackingMetadata(
    entry,
    personalization,
  )

  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height)

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenHeight(window.height)
    })
    return () => {
      subscription.remove()
    }
  }, [])

  const scrollY = scrollContext ? scrollContext.scrollY : 0
  const viewportHeight = scrollContext ? scrollContext.viewportHeight : screenHeight

  const dimensionsRef = useRef<{ y: number; height: number } | null>(null)
  const isVisibleRef = useRef(false)
  const fireTimerRef = useRef<NodeJS.Timeout | null>(null)
  const cycleRef = useRef<ViewCycleState>(createInitialCycleState())

  const optimizationRef = useRef(contentfulOptimization)
  optimizationRef.current = contentfulOptimization

  const componentIdRef = useRef(componentId)
  componentIdRef.current = componentId
  const experienceIdRef = useRef(experienceId)
  experienceIdRef.current = experienceId
  const variantIndexRef = useRef(variantIndex)
  variantIndexRef.current = variantIndex

  logger.debug(
    `Hook initialized for ${componentId} (experienceId: ${experienceId}, variantIndex: ${variantIndex})`,
  )

  useEffect(() => {
    logger.debug(`Hook mounted/updated for ${componentId}`)
    return () => {
      logger.debug(`Hook unmounting for ${componentId}`)
    }
  }, [])

  const clearFireTimer = useCallback(() => {
    if (fireTimerRef.current) {
      clearTimeout(fireTimerRef.current)
      fireTimerRef.current = null
    }
  }, [])

  const emitViewEvent = useCallback(() => {
    const { current: cycle } = cycleRef
    const now = Date.now()
    flushAccumulatedTime(cycle, now)

    const viewId = cycle.viewId ?? createViewId()
    const durationMs = Math.max(0, Math.round(cycle.accumulatedMs))

    cycle.attempts += 1

    logger.info(
      `Emitting view event #${cycle.attempts} for ${componentIdRef.current} (viewDurationMs=${durationMs}, viewId=${viewId})`,
    )

    void (async () => {
      await optimizationRef.current.trackView({
        componentId: componentIdRef.current,
        viewId,
        experienceId: experienceIdRef.current,
        variantIndex: variantIndexRef.current,
        viewDurationMs: durationMs,
      })
    })()
  }, [])

  const scheduleNextFire = useCallback(() => {
    clearFireTimer()
    const { current: cycle } = cycleRef

    if (cycle.viewId === null || cycle.visibleSince === null) {
      return
    }

    const now = Date.now()
    flushAccumulatedTime(cycle, now)

    const remainingMs = getRemainingMsUntilNextFire(cycle, viewTimeMs, viewDurationUpdateIntervalMs)

    if (remainingMs <= 0) {
      emitViewEvent()
      scheduleNextFire()
      return
    }

    logger.debug(
      `Scheduling next fire for ${componentIdRef.current} in ${remainingMs}ms (attempt #${cycle.attempts + 1})`,
    )

    fireTimerRef.current = setTimeout(() => {
      if (!isVisibleRef.current) {
        return
      }
      emitViewEvent()
      scheduleNextFire()
    }, remainingMs)
  }, [clearFireTimer, emitViewEvent, viewTimeMs, viewDurationUpdateIntervalMs])

  const onVisibilityStart = useCallback(() => {
    if (!enabled) return

    const { current: cycle } = cycleRef
    const now = Date.now()

    resetCycleState(cycle)
    cycle.viewId = createViewId()
    cycle.visibleSince = now

    logger.info(`Visibility cycle started for ${componentIdRef.current} (id=${cycle.viewId})`)

    scheduleNextFire()
  }, [enabled, scheduleNextFire])

  const onVisibilityEnd = useCallback(() => {
    const { current: cycle } = cycleRef
    const now = Date.now()

    clearFireTimer()
    pauseAccumulation(cycle, now)

    if (cycle.viewId !== null && cycle.attempts > 0) {
      logger.info(
        `Visibility ended for ${componentIdRef.current} after ${cycle.attempts} events, emitting final`,
      )
      emitViewEvent()
    } else {
      logger.debug(
        `Visibility ended for ${componentIdRef.current} before dwell threshold, no final event`,
      )
    }

    resetCycleState(cycle)
  }, [clearFireTimer, emitViewEvent])

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

    const viewportTop = scrollY
    const viewportBottom = scrollY + viewportHeight

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
      onVisibilityStart()
    } else if (!isNowVisible && wasVisible) {
      logger.info(
        `${componentId} became invisible (${(visibilityRatio * PERCENTAGE_MULTIPLIER).toFixed(1)}%)`,
      )
      onVisibilityEnd()
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
    onVisibilityStart,
    onVisibilityEnd,
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

      checkVisibility()
    },
    [componentId, checkVisibility],
  )

  useEffect(() => {
    checkVisibility()
  }, [scrollY, viewportHeight, checkVisibility])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const { current: cycle } = cycleRef

      if (nextState === 'background' || nextState === 'inactive') {
        if (cycle.visibleSince !== null) {
          const now = Date.now()
          clearFireTimer()
          pauseAccumulation(cycle, now)

          if (cycle.attempts > 0) {
            logger.info(`App backgrounded, emitting final event for ${componentIdRef.current}`)
            emitViewEvent()
            resetCycleState(cycle)
            isVisibleRef.current = false
          }
        }
      } else if (nextState === 'active') {
        if (dimensionsRef.current !== null) {
          isVisibleRef.current = false
          checkVisibility()
        }
      }
    })

    return () => {
      subscription.remove()
    }
  }, [clearFireTimer, emitViewEvent, checkVisibility])

  useEffect(
    () => () => {
      if (fireTimerRef.current) {
        clearTimeout(fireTimerRef.current)
      }
      const { current: cycle } = cycleRef
      if (cycle.viewId !== null && cycle.attempts > 0) {
        pauseAccumulation(cycle, Date.now())
        emitViewEvent()
      }
      resetCycleState(cycle)
    },
    [],
  )

  return {
    isVisible: isVisibleRef.current,
    onLayout: handleLayout,
  }
}

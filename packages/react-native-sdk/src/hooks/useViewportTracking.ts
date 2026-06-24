import {
  getRemainingMsUntilNextEntryViewFire,
  resolveEntryViewTimingOptions,
  shouldRememberStickyEntryViewResult,
  shouldSendStickyEntryView,
} from '@contentful/optimization-core'
import type { SelectedOptimization } from '@contentful/optimization-core/api-schemas'
import { createScopedLogger } from '@contentful/optimization-core/logger'
import type { Entry } from 'contentful'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Dimensions, type LayoutChangeEvent } from 'react-native'
import { useOptimization } from '../context/OptimizationContext'
import { useScrollContext } from '../context/OptimizationScrollContext'
import { useOptimizationConsentState } from './useOptimizationConsentState'

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
   * Selected optimization data for variant tracking. Omit for baseline/non-optimized entries.
   */
  selectedOptimization?: SelectedOptimization

  /**
   * Opaque runtime-owned optimization context ID for event-stream enrichment.
   */
  optimizationContextId?: string

  /**
   * Minimum visibility ratio (0.0 - 1.0) required to consider the entry visible.
   *
   * @defaultValue `0.8`
   */
  minVisibleRatio?: number

  /**
   * Minimum accumulated visible time (in milliseconds) before the first tracking event fires.
   *
   * @defaultValue `2000`
   */
  dwellTimeMs?: number

  /**
   * Whether view tracking is enabled for this entry.
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
   * @defaultValue `5000`
   */
  viewDurationUpdateIntervalMs?: number
}

/**
 * Return value of the {@link useViewportTracking} hook.
 *
 * @public
 */
export interface UseViewportTrackingReturn {
  /** Whether the tracked element is visible in the viewport. */
  isVisible: boolean

  /** Layout callback to attach to the tracked View's `onLayout` prop. */
  onLayout: (event: LayoutChangeEvent) => void
}

const PERCENTAGE_MULTIPLIER = 100
const DEFAULT_MIN_VISIBLE_RATIO = 0.8
const DEFAULT_DWELL_TIME_MS = 2000
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

interface StickyState {
  accepted: boolean
  inFlight: boolean
  generation: number
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
 * Extracts tracking metadata from a resolved entry and optional selected optimization data.
 *
 * @param resolvedEntry - The resolved Contentful entry (baseline or variant).
 * @param selectedOptimization - Optional selected optimization for variant tracking.
 * @returns Wire-format tracking metadata containing `componentId`, optional
 *   `experienceId`, and `variantIndex`.
 *
 * @internal
 */
export function extractTrackingMetadata(
  resolvedEntry: Entry,
  selectedOptimization?: SelectedOptimization,
  optimizationContextId?: string,
): {
  componentId: string
  experienceId?: string
  optimizationContextId?: string
  variantIndex: number
  sticky?: boolean
} {
  if (selectedOptimization) {
    const componentId = Object.keys(selectedOptimization.variants).find(
      (baselineId) => selectedOptimization.variants[baselineId] === resolvedEntry.sys.id,
    )

    return {
      componentId: componentId ?? resolvedEntry.sys.id,
      experienceId: selectedOptimization.experienceId,
      optimizationContextId,
      variantIndex: selectedOptimization.variantIndex,
      sticky: selectedOptimization.sticky,
    }
  }

  return {
    componentId: resolvedEntry.sys.id,
    experienceId: undefined,
    optimizationContextId,
    variantIndex: 0,
    sticky: undefined,
  }
}

/**
 * Compute remaining ms until the next event fires, based on accumulated
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
  return getRemainingMsUntilNextEntryViewFire({
    dwellTimeMs,
    viewDurationUpdateIntervalMs: updateIntervalMs,
    attempts: cycle.attempts,
    accumulatedMs: cycle.accumulatedMs,
  })
}

/**
 * Tracks whether an entry is visible in the viewport and fires entry view
 * events with accumulated duration tracking.
 *
 * The hook implements a three-phase event lifecycle per visibility cycle:
 * 1. **Initial event** after accumulated visible time reaches `dwellTimeMs`.
 * 2. **Periodic updates** every `viewDurationUpdateIntervalMs` while visible.
 * 3. **Final event** when visibility ends (only if at least one event was already emitted).
 *
 * @param options - {@link UseViewportTrackingOptions} including the entry, visibility timing, and selected optimization data.
 * @returns An object with `isVisible` state and an `onLayout` callback for the tracked View.
 *
 * @throws Error if called outside of an {@link OptimizationProvider}
 *
 * @remarks
 * Uses {@link useScrollContext} if available, otherwise falls back to screen dimensions.
 * A new visibility cycle (with a fresh `viewId`) starts each time the tracked
 * entry transitions from invisible to visible. Time accumulation pauses when
 * the app moves to the background.
 * If `trackView` is blocked by consent, visibility timing starts only after
 * Core allows the event type.
 *
 * @example
 * ```tsx
 * function TrackedEntry({ entry }: { entry: Entry }) {
 *   const { onLayout, isVisible } = useViewportTracking({
 *     entry,
 *     minVisibleRatio: 0.8,
 *     dwellTimeMs: 2000,
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
  optimizationContextId,
  selectedOptimization,
  minVisibleRatio,
  dwellTimeMs,
  enabled = true,
  viewDurationUpdateIntervalMs,
}: UseViewportTrackingOptions): UseViewportTrackingReturn {
  const timing = resolveEntryViewTimingOptions(
    { dwellTimeMs, minVisibleRatio, viewDurationUpdateIntervalMs },
    {
      dwellTimeMs: DEFAULT_DWELL_TIME_MS,
      minVisibleRatio: DEFAULT_MIN_VISIBLE_RATIO,
      viewDurationUpdateIntervalMs: DEFAULT_VIEW_DURATION_UPDATE_INTERVAL_MS,
    },
  )
  const contentfulOptimization = useOptimization()
  const consent = useOptimizationConsentState(contentfulOptimization)
  const viewTrackingAllowed = contentfulOptimization.hasConsent('trackView')
  const {
    sys: { id: entryId },
  } = entry

  const scrollContext = useScrollContext()

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
  const fireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cycleRef = useRef<ViewCycleState>(createInitialCycleState())

  const optimizationRef = useRef(contentfulOptimization)
  optimizationRef.current = contentfulOptimization
  const viewTrackingAllowedRef = useRef(viewTrackingAllowed)
  viewTrackingAllowedRef.current = viewTrackingAllowed
  const entryRef = useRef(entry)
  entryRef.current = entry
  const selectedOptimizationRef = useRef(selectedOptimization)
  selectedOptimizationRef.current = selectedOptimization
  const optimizationContextIdRef = useRef(optimizationContextId)
  optimizationContextIdRef.current = optimizationContextId

  const stickyStateRef = useRef<StickyState>({
    accepted: false,
    inFlight: false,
    generation: 0,
  })

  useEffect(() => {
    const { current: stickyState } = stickyStateRef
    stickyState.accepted = false
    stickyState.inFlight = false
    stickyState.generation += 1
  }, [entry, selectedOptimization])

  logger.debug(`Hook initialized for ${entryId}`)

  useEffect(() => {
    logger.debug(`Hook mounted/updated for ${entryId}`)
    return () => {
      logger.debug(`Hook unmounting for ${entryId}`)
    }
  }, [])

  const clearFireTimer = useCallback(() => {
    if (fireTimerRef.current) {
      clearTimeout(fireTimerRef.current)
      fireTimerRef.current = null
    }
  }, [])

  const emitViewEvent = useCallback(() => {
    if (!viewTrackingAllowedRef.current) return

    const { current: cycle } = cycleRef
    const now = Date.now()
    flushAccumulatedTime(cycle, now)

    const viewId = cycle.viewId ?? createViewId()
    const durationMs = Math.max(0, Math.round(cycle.accumulatedMs))
    const { componentId, experienceId, optimizationContextId, variantIndex, sticky } =
      extractTrackingMetadata(
        entryRef.current,
        selectedOptimizationRef.current,
        optimizationContextIdRef.current,
      )

    cycle.attempts += 1

    logger.info(
      `Emitting view event #${cycle.attempts} for ${componentId} (viewDurationMs=${durationMs}, viewId=${viewId})`,
    )

    const { current: stickyState } = stickyStateRef
    const { generation: stickyGeneration } = stickyState
    const shouldSendSticky = shouldSendStickyEntryView(
      sticky,
      stickyState.accepted || stickyState.inFlight,
    )

    if (shouldSendSticky) stickyState.inFlight = true

    void (async () => {
      try {
        const result = await optimizationRef.current.trackView({
          componentId,
          viewId,
          experienceId,
          ...(optimizationContextId === undefined ? {} : { optimizationContextId }),
          variantIndex,
          viewDurationMs: durationMs,
          sticky: shouldSendSticky ? true : undefined,
        })

        if (stickyStateRef.current.generation !== stickyGeneration) return

        if (
          shouldSendSticky &&
          shouldRememberStickyEntryViewResult(shouldSendSticky, result.accepted)
        ) {
          stickyStateRef.current.accepted = true
        }
      } catch (error) {
        logger.error(`Failed to emit view event for ${componentId} (viewId=${viewId})`, error)
      } finally {
        if (stickyStateRef.current.generation === stickyGeneration && shouldSendSticky) {
          stickyStateRef.current.inFlight = false
        }
      }
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

    const remainingMs = getRemainingMsUntilNextFire(
      cycle,
      timing.dwellTimeMs,
      timing.viewDurationUpdateIntervalMs,
    )

    if (remainingMs <= 0) {
      emitViewEvent()
      scheduleNextFire()
      return
    }

    logger.debug(
      `Scheduling next fire for ${entryId} in ${remainingMs}ms (attempt #${cycle.attempts + 1})`,
    )

    fireTimerRef.current = setTimeout(() => {
      if (!isVisibleRef.current) {
        return
      }
      emitViewEvent()
      scheduleNextFire()
    }, remainingMs)
  }, [clearFireTimer, timing.dwellTimeMs, emitViewEvent, timing.viewDurationUpdateIntervalMs])

  const onVisibilityStart = useCallback(() => {
    if (!enabled || !viewTrackingAllowedRef.current) return

    const { current: cycle } = cycleRef
    const now = Date.now()

    resetCycleState(cycle)
    cycle.viewId = createViewId()
    cycle.visibleSince = now

    logger.info(`Visibility cycle started for ${entryId} (id=${cycle.viewId})`)

    scheduleNextFire()
  }, [enabled, scheduleNextFire])

  const onVisibilityEnd = useCallback(() => {
    const { current: cycle } = cycleRef
    const now = Date.now()

    clearFireTimer()
    pauseAccumulation(cycle, now)

    if (cycle.viewId !== null && cycle.attempts > 0) {
      logger.info(`Visibility ended for ${entryId} after ${cycle.attempts} events, emitting final`)
      emitViewEvent()
    } else {
      logger.debug(`Visibility ended for ${entryId} before dwell requirement, no final event`)
    }

    resetCycleState(cycle)
  }, [clearFireTimer, emitViewEvent])

  const canCheckVisibility = useCallback((): boolean => {
    const { current: dimensions } = dimensionsRef
    if (!dimensions) {
      logger.debug(`${entryId} has no dimensions yet`)
      return false
    }

    if (viewportHeight === 0) {
      const context = scrollContext
        ? '(waiting for ScrollView layout)'
        : '(waiting for screen dimensions)'
      logger.debug(`${entryId} viewport height is 0 ${context}`)
      return false
    }

    return true
  }, [entryId, viewportHeight, scrollContext])

  const checkVisibility = useCallback(() => {
    logger.debug(`checkVisibility called for ${entryId}`)

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
      `${entryId} visibility check ${contextType}:
  Element: y=${elementY.toFixed(0)}, bottom=${elementBottom.toFixed(0)}
  Viewport: scrollY=${scrollY.toFixed(0)}, height=${viewportHeight.toFixed(0)}, top=${viewportTop.toFixed(0)}, bottom=${viewportBottom.toFixed(0)}
  Visible: height=${visibleHeight.toFixed(0)}, ratio=${visibilityRatio.toFixed(2)}, minVisibleRatio=${timing.minVisibleRatio}`,
    )

    const isNowVisible = viewTrackingAllowedRef.current && visibilityRatio >= timing.minVisibleRatio
    const { current: wasVisible } = isVisibleRef
    isVisibleRef.current = isNowVisible

    if (isNowVisible && !wasVisible) {
      logger.info(`${entryId} transitioned from invisible to visible`)
      onVisibilityStart()
    } else if (!isNowVisible && wasVisible) {
      logger.info(
        `${entryId} became invisible (${(visibilityRatio * PERCENTAGE_MULTIPLIER).toFixed(1)}%)`,
      )
      onVisibilityEnd()
    } else if (!isNowVisible) {
      logger.debug(
        `${entryId} is not visible enough (${(visibilityRatio * PERCENTAGE_MULTIPLIER).toFixed(1)}%)`,
      )
    } else {
      logger.debug(
        `${entryId} remains visible (${(visibilityRatio * PERCENTAGE_MULTIPLIER).toFixed(1)}%)`,
      )
    }
  }, [
    canCheckVisibility,
    entryId,
    timing.minVisibleRatio,
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
        `Layout for ${entryId}: y=${y}, height=${height} (position within ScrollView content)`,
      )
      dimensionsRef.current = { y, height }

      checkVisibility()
    },
    [entryId, checkVisibility],
  )

  useEffect(() => {
    checkVisibility()
  }, [consent, scrollY, viewportHeight, viewTrackingAllowed, checkVisibility])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const { current: cycle } = cycleRef

      if (nextState === 'background' || nextState === 'inactive') {
        if (cycle.visibleSince !== null) {
          const now = Date.now()
          clearFireTimer()
          pauseAccumulation(cycle, now)

          if (cycle.attempts > 0) {
            logger.info(`App backgrounded, emitting final event for ${entryId}`)
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

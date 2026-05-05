import type { ResolvedData } from '@contentful/optimization-core'
import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import { isOptimizedEntry } from '@contentful/optimization-core/api-schemas'
import type { Entry, EntrySkeletonType } from 'contentful'
import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useInteractionTracking } from '../context/InteractionTrackingContext'
import { useLiveUpdates } from '../context/LiveUpdatesContext'
import { useOptimization } from '../context/OptimizationContext'
import { useTapTracking } from '../hooks/useTapTracking'
import { useViewportTracking } from '../hooks/useViewportTracking'

/**
 * Props for the {@link OptimizedEntry} component.
 *
 * @public
 */
export interface OptimizedEntryProps {
  /**
   * The Contentful entry to optimize and track.
   * For optimized entries (those with `nt_experiences`), the component
   * automatically resolves variants. For non-optimized entries, the
   * entry is passed through unchanged.
   *
   * @example
   * ```typescript
   * const entry = await contentful.getEntry('entry-id', {
   *   include: 10,
   * })
   * ```
   */
  entry: Entry

  /**
   * Content to render. Accepts either a render prop or static children.
   *
   * - **Render prop** `(resolvedEntry: Entry) => ReactNode`: receives the
   *   resolved entry (variant or baseline) and returns content to render.
   *   Use this when you need the resolved entry data.
   * - **Static children** `ReactNode`: rendered as-is without entry data.
   *   Use this when you only need tracking, not variant resolution.
   *
   * @example Render prop (optimized content)
   * ```tsx
   * <OptimizedEntry entry={entry}>
   *   {(resolvedEntry) => (
   *     <HeroComponent
   *       title={resolvedEntry.fields.title}
   *       image={resolvedEntry.fields.image}
   *     />
   *   )}
   * </OptimizedEntry>
   * ```
   *
   * @example Static children (tracking only)
   * ```tsx
   * <OptimizedEntry entry={productEntry}>
   *   <ProductCard name={productEntry.fields.name} />
   * </OptimizedEntry>
   * ```
   */
  children: ReactNode | ((resolvedEntry: Entry) => ReactNode)

  /**
   * Minimum time (in milliseconds) the component must be visible
   * before tracking fires.
   *
   * @defaultValue `2000`
   */
  viewTimeMs?: number

  /**
   * Minimum visibility ratio (0.0 - 1.0) required to consider
   * the component "visible".
   *
   * @defaultValue `0.8`
   */
  threshold?: number

  /**
   * Interval (in milliseconds) between periodic view duration update events
   * after the initial event has fired.
   *
   * @defaultValue `5000`
   */
  viewDurationUpdateIntervalMs?: number

  /**
   * Optional style prop for the wrapper View.
   */
  style?: StyleProp<ViewStyle>

  /**
   * Optional testID for testing purposes.
   */
  testID?: string

  /**
   * Whether this component reacts to optimization state changes in real time.
   * Only applies to optimized entries; ignored for non-optimized entries.
   * When `undefined`, inherits from the `liveUpdates` prop on {@link OptimizationRoot}.
   * When `false` (or inherited as `false`), the component locks to the first variant
   * it receives, preventing UI flashing when user actions change their qualification.
   * When `true`, the component updates immediately when selected optimizations change.
   *
   * @defaultValue `undefined`
   *
   * @remarks
   * Live updates are always enabled when the preview panel is open,
   * regardless of this setting.
   */
  liveUpdates?: boolean

  /**
   * Per-component override for view tracking.
   * - `undefined`: inherits from `trackEntryInteraction.views` on {@link OptimizationRoot}
   * - `true`: enable view tracking for this entry
   * - `false`: disable view tracking for this entry
   *
   * @defaultValue `undefined`
   */
  trackViews?: boolean

  /**
   * Per-component override for tap tracking.
   * - `undefined`: inherits from `trackEntryInteraction.taps` on {@link OptimizationRoot}
   * - `true`: enable tap tracking for this entry
   * - `false`: disable tap tracking (overrides the global setting)
   *
   * @defaultValue `undefined`
   */
  trackTaps?: boolean

  /**
   * Optional callback invoked with the resolved entry after a tap tracking event is emitted.
   * When provided, implicitly enables tap tracking unless `trackTaps` is explicitly `false`.
   *
   * @defaultValue `undefined`
   */
  onTap?: (resolvedEntry: Entry) => void
}

function resolveTapsEnabled(
  trackTaps: boolean | undefined,
  onTap: ((resolvedEntry: Entry) => void) | undefined,
  globalTaps: boolean,
): boolean {
  if (trackTaps !== undefined) return trackTaps
  if (onTap) return true
  return globalTaps
}

/**
 * Unified component for tracking and personalizing Contentful entries.
 *
 * Handles both optimized entries (with `nt_experiences`) and non-optimized
 * entries. For optimized entries, it resolves the correct variant based on the
 * user's profile. For all entries, it tracks views and taps.
 *
 * @param props - {@link OptimizedEntryProps}
 * @returns A wrapper View with interaction tracking attached.
 *
 * @remarks
 * "Tracking" refers to tracking Contentful content entries,
 * not React Native UI components. Must be used within an {@link OptimizationProvider}.
 * Works with or without an {@link OptimizationScrollProvider} — when outside an
 * {@link OptimizationScrollProvider}, screen dimensions are used instead.
 *
 * By default the component locks to the first variant it receives to prevent UI
 * flashing. Set `liveUpdates` to `true` or open the preview panel to enable
 * real-time variant switching.
 *
 * @example Basic usage with render prop
 * ```tsx
 * <OptimizationScrollProvider>
 *   <OptimizedEntry entry={entry}>
 *     {(resolvedEntry) => (
 *       <HeroComponent
 *         title={resolvedEntry.fields.title}
 *         image={resolvedEntry.fields.image}
 *       />
 *     )}
 *   </OptimizedEntry>
 * </OptimizationScrollProvider>
 * ```
 *
 * @example Static children (tracking only)
 * ```tsx
 * <OptimizedEntry entry={productEntry}>
 *   <ProductCard name={productEntry.fields.name} />
 * </OptimizedEntry>
 * ```
 *
 * @example With tap tracking
 * ```tsx
 * <OptimizedEntry entry={entry} trackTaps>
 *   {(resolvedEntry) => (
 *     <Pressable onPress={() => navigate(resolvedEntry)}>
 *       <Card title={resolvedEntry.fields.title} />
 *     </Pressable>
 *   )}
 * </OptimizedEntry>
 * ```
 *
 * @see {@link OptimizationRoot} for configuring global interaction tracking
 * @see {@link useLiveUpdates} for reading live update state programmatically
 *
 * @public
 */
export function OptimizedEntry({
  entry,
  children,
  viewTimeMs,
  threshold,
  viewDurationUpdateIntervalMs,
  style,
  testID,
  liveUpdates,
  trackViews,
  trackTaps,
  onTap,
}: OptimizedEntryProps): React.JSX.Element {
  const contentfulOptimization = useOptimization()
  const liveUpdatesContext = useLiveUpdates()
  const interactionTracking = useInteractionTracking()

  const isOptimized = isOptimizedEntry(entry)

  const shouldLiveUpdate =
    liveUpdatesContext?.previewPanelVisible === true ||
    (liveUpdates ?? liveUpdatesContext?.globalLiveUpdates ?? false)

  const [lockedSelectedOptimizations, setLockedSelectedOptimizations] = useState<
    SelectedOptimizationArray | undefined
  >(undefined)

  const isLockedRef = useRef(false)

  useEffect(() => {
    if (shouldLiveUpdate) {
      isLockedRef.current = false
    }
  }, [shouldLiveUpdate])

  useEffect(() => {
    if (!isOptimized) return

    const subscription = contentfulOptimization.states.selectedOptimizations.subscribe(
      (nextSelectedOptimizations) => {
        if (shouldLiveUpdate) {
          setLockedSelectedOptimizations(nextSelectedOptimizations)
        } else if (!isLockedRef.current && nextSelectedOptimizations !== undefined) {
          isLockedRef.current = true
          setLockedSelectedOptimizations(nextSelectedOptimizations)
        }
      },
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [contentfulOptimization, shouldLiveUpdate, isOptimized])

  const resolvedData: ResolvedData<EntrySkeletonType> = useMemo(
    () =>
      isOptimized
        ? contentfulOptimization.resolveOptimizedEntry(entry, lockedSelectedOptimizations)
        : { entry },
    [entry, contentfulOptimization, lockedSelectedOptimizations, isOptimized],
  )

  const viewsEnabled = trackViews ?? interactionTracking.views
  const tapsEnabled = resolveTapsEnabled(trackTaps, onTap, interactionTracking.taps)

  const { onLayout } = useViewportTracking({
    entry: resolvedData.entry,
    selectedOptimization: resolvedData.selectedOptimization,
    threshold,
    viewTimeMs,
    viewDurationUpdateIntervalMs,
    enabled: viewsEnabled,
  })

  const { onTouchStart, onTouchEnd } = useTapTracking({
    entry: resolvedData.entry,
    selectedOptimization: resolvedData.selectedOptimization,
    enabled: tapsEnabled,
    onTap,
  })

  return (
    <View
      style={style}
      onLayout={onLayout}
      testID={testID}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {typeof children === 'function' ? children(resolvedData.entry) : children}
    </View>
  )
}

export default OptimizedEntry

import type { ResolvedData } from '@contentful/optimization-core'
import type { SelectedPersonalizationArray } from '@contentful/optimization-core/api-schemas'
import type { Entry, EntrySkeletonType } from 'contentful'
import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useInteractionTracking } from '../context/InteractionTrackingContext'
import { useLiveUpdates } from '../context/LiveUpdatesContext'
import { useOptimization } from '../context/OptimizationContext'
import { useTapTracking } from '../hooks/useTapTracking'
import { useViewportTracking } from '../hooks/useViewportTracking'

/**
 * Props for the {@link Personalization} component.
 *
 * @public
 */
export interface PersonalizationProps {
  /**
   * The baseline Contentful entry fetched with `include: 10`.
   * Must include `nt_experiences` field with linked personalization data.
   *
   * @example
   * ```typescript
   * const baselineEntry = await contentful.getEntry('hero-baseline-id', {
   *   include: 10,
   * })
   * ```
   */
  baselineEntry: Entry

  /**
   * Render prop that receives the resolved variant entry.
   * Called with the baseline entry if no personalization matches,
   * or with the selected variant entry if personalization applies.
   *
   * @param resolvedEntry - The entry to display (baseline or variant)
   *
   * @returns ReactNode to render
   *
   * @example
   * ```tsx
   * <Personalization baselineEntry={entry}>
   *   {(resolvedEntry) => (
   *     <HeroComponent
   *       title={resolvedEntry.fields.title}
   *       image={resolvedEntry.fields.image}
   *     />
   *   )}
   * </Personalization>
   * ```
   */
  children: (resolvedEntry: Entry) => ReactNode

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
   * @defaultValue 5000
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
   * Whether this component should react to personalization state changes in real-time.
   * When `undefined`, inherits from the `liveUpdates` prop on {@link OptimizationRoot}.
   * When `false` (or inherited as `false`), the component locks to the first variant
   * it receives, preventing UI flashing when user actions change their qualification.
   * When `true`, the component updates immediately when personalizations change.
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

/**
 * Tracks views and taps of personalized Contentful entry components and resolves variants
 * based on the user's profile and active personalizations.
 *
 * @param props - {@link PersonalizationProps}
 * @returns A wrapper View with interaction tracking attached
 *
 * @remarks
 * "Component tracking" refers to tracking Contentful entry components (content entries),
 * not React Native UI components. Must be used within an {@link OptimizationProvider}.
 * Works with or without a {@link OptimizationScrollProvider} — when outside a OptimizationScrollProvider,
 * screen dimensions are used instead.
 *
 * By default the component locks to the first variant it receives to prevent UI
 * flashing. Set `liveUpdates` to `true` or open the preview panel to enable
 * real-time variant switching.
 *
 * @example Basic Usage
 * ```tsx
 * <OptimizationScrollProvider>
 *   <Personalization baselineEntry={baselineEntry}>
 *     {(resolvedEntry) => (
 *       <HeroComponent
 *         title={resolvedEntry.fields.title}
 *         image={resolvedEntry.fields.image}
 *       />
 *     )}
 *   </Personalization>
 * </OptimizationScrollProvider>
 * ```
 * @example With Tap Tracking
 * ```tsx
 * <Personalization baselineEntry={entry} trackTaps>
 *   {(resolvedEntry) => (
 *     <Pressable onPress={() => navigate(resolvedEntry)}>
 *       <Card title={resolvedEntry.fields.title} />
 *     </Pressable>
 *   )}
 * </Personalization>
 * ```
 *
 * @see {@link Analytics} for tracking non-personalized entries
 * @see {@link OptimizationRoot} for configuring global interaction tracking
 *
 * @public
 */
export function Personalization({
  baselineEntry,
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
}: PersonalizationProps): React.JSX.Element {
  const optimization = useOptimization()
  const liveUpdatesContext = useLiveUpdates()
  const interactionTracking = useInteractionTracking()

  const shouldLiveUpdate =
    liveUpdatesContext?.previewPanelVisible === true ||
    (liveUpdates ?? liveUpdatesContext?.globalLiveUpdates ?? false)

  const [lockedPersonalizations, setLockedPersonalizations] = useState<
    SelectedPersonalizationArray | undefined
  >(undefined)

  const isLockedRef = useRef(false)

  useEffect(() => {
    if (shouldLiveUpdate) {
      isLockedRef.current = false
    }
  }, [shouldLiveUpdate])

  useEffect(() => {
    const subscription = optimization.states.personalizations.subscribe((p) => {
      if (shouldLiveUpdate) {
        setLockedPersonalizations(p)
      } else if (!isLockedRef.current && p !== undefined) {
        isLockedRef.current = true
        setLockedPersonalizations(p)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [optimization, shouldLiveUpdate])

  const resolvedData: ResolvedData<EntrySkeletonType> = useMemo(
    () => optimization.personalizeEntry(baselineEntry, lockedPersonalizations),
    [baselineEntry, optimization, lockedPersonalizations],
  )

  const viewsEnabled = trackViews ?? interactionTracking.views
  const tapsEnabled =
    trackTaps === false ? false : (trackTaps ?? onTap) ? true : interactionTracking.taps

  const { onLayout } = useViewportTracking({
    entry: resolvedData.entry,
    personalization: resolvedData.personalization,
    threshold,
    viewTimeMs,
    viewDurationUpdateIntervalMs,
    enabled: viewsEnabled,
  })

  const { onTouchStart, onTouchEnd } = useTapTracking({
    entry: resolvedData.entry,
    personalization: resolvedData.personalization,
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
      {children(resolvedData.entry)}
    </View>
  )
}

export default Personalization

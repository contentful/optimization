import type { Entry } from 'contentful'
import React, { type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useInteractionTracking } from '../context/InteractionTrackingContext'
import { useTapTracking } from '../hooks/useTapTracking'
import { useViewportTracking } from '../hooks/useViewportTracking'

/**
 * Props for the {@link Analytics} component.
 *
 * @public
 */
export interface AnalyticsProps {
  /**
   * The Contentful entry to track (non-personalized content).
   *
   * @example
   * ```typescript
   * const productEntry = await contentful.getEntry('product-123')
   * ```
   */
  entry: Entry

  /**
   * Child components to render. Unlike {@link Personalization}, this uses
   * a standard children pattern since no variant resolution is needed.
   */
  children: ReactNode

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
   * Optional style prop for the wrapper View.
   */
  style?: StyleProp<ViewStyle>

  /**
   * Optional testID for testing purposes.
   */
  testID?: string

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
   * Optional callback invoked with the entry after a tap tracking event is emitted.
   * When provided, implicitly enables tap tracking unless `trackTaps` is explicitly `false`.
   *
   * @defaultValue `undefined`
   */
  onTap?: (entry: Entry) => void
}

/**
 * Tracks views and taps of non-personalized Contentful entry components (content entries).
 *
 * Use this component for standard Contentful entries you want analytics on
 * (products, articles, etc.) that are not personalized.
 *
 * @param props - {@link AnalyticsProps}
 * @returns A wrapper View with interaction tracking attached
 *
 * @remarks
 * Must be used within an {@link OptimizationProvider}. Works with or without a
 * {@link OptimizationScrollProvider} — when outside a OptimizationScrollProvider, screen dimensions are
 * used instead. Tracks with `variantIndex: 0` and no `experienceId` to indicate
 * baseline/non-personalized content.
 *
 * @example Basic Usage
 * ```tsx
 * <OptimizationScrollProvider>
 *   <Analytics entry={productEntry}>
 *     <ProductCard
 *       name={productEntry.fields.name}
 *       price={productEntry.fields.price}
 *     />
 *   </Analytics>
 * </OptimizationScrollProvider>
 * ```
 * @example With Tap Tracking
 * ```tsx
 * <Analytics entry={productEntry} trackTaps>
 *   <Pressable onPress={() => navigate(productEntry)}>
 *     <ProductCard name={productEntry.fields.name} />
 *   </Pressable>
 * </Analytics>
 * ```
 *
 * @see {@link Personalization} for tracking personalized entries
 *
 * @public
 */
export function Analytics({
  entry,
  children,
  viewTimeMs,
  threshold,
  style,
  testID,
  trackViews,
  trackTaps,
  onTap,
}: AnalyticsProps): React.JSX.Element {
  const interactionTracking = useInteractionTracking()

  const viewsEnabled = trackViews ?? interactionTracking.views
  const tapsEnabled =
    trackTaps === false ? false : (trackTaps ?? onTap) ? true : interactionTracking.taps

  const { onLayout } = useViewportTracking({
    entry,
    threshold,
    viewTimeMs,
    enabled: viewsEnabled,
  })

  const { onTouchStart, onTouchEnd } = useTapTracking({
    entry,
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
      {children}
    </View>
  )
}

export default Analytics

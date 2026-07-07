import type {
  ContentfulEntryQuery,
  OptimizedEntryMetadata,
  ResolvedData,
} from '@contentful/optimization-core'
import type { Entry, EntrySkeletonType } from 'contentful'
import React, { type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useInteractionTracking } from '../context/InteractionTrackingContext'
import { useOptimizedEntry, type UseOptimizedEntryParams } from '../hooks/useOptimizedEntry'
import { useTapTracking } from '../hooks/useTapTracking'
import { useViewportTracking } from '../hooks/useViewportTracking'

export type OptimizedEntryLoadingFallback = ReactNode | (() => ReactNode)
export type OptimizedEntryErrorFallback = ReactNode | ((error: Error) => ReactNode)
export type OptimizedEntryRenderProp = (
  resolvedEntry: Entry,
  metadata: OptimizedEntryMetadata,
) => ReactNode
export type OptimizedEntryChildren = ReactNode | OptimizedEntryRenderProp

/**
 * Shared props for the {@link OptimizedEntry} component.
 *
 * @public
 */
interface OptimizedEntrySharedProps {
  /**
   * Content to render. Accepts either a render prop or static children.
   *
   * - **Render prop** `(resolvedEntry: Entry, metadata: OptimizedEntryMetadata) => ReactNode`:
   *   receives the resolved entry plus baseline and optimization metadata.
   *   Use this when you need the resolved entry data.
   * - **Static children** `ReactNode`: rendered as-is without entry data.
   *   Use this when you only need tracking, not variant resolution.
   *
   * @example Render prop (optimized content)
   * ```tsx
   * <OptimizedEntry baselineEntry={entry}>
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
   * <OptimizedEntry baselineEntry={productEntry}>
   *   <ProductCard name={productEntry.fields.name} />
   * </OptimizedEntry>
   * ```
   */
  children: OptimizedEntryChildren

  /**
   * Optional fallback rendered while SDK-managed entry fetching is pending.
   */
  loadingFallback?: OptimizedEntryLoadingFallback

  /**
   * Optional fallback rendered when SDK-managed entry fetching fails.
   */
  errorFallback?: OptimizedEntryErrorFallback

  /**
   * Callback invoked once for each SDK-managed entry fetching error.
   */
  onEntryError?: (error: Error) => void

  /**
   * Callback invoked when a resolved entry is rendered with tracking ready.
   */
  onEntryResolved?: (metadata: OptimizedEntryMetadata) => void

  /**
   * Minimum time (in milliseconds) the component must be visible
   * before tracking fires.
   *
   * @defaultValue `2000`
   */
  dwellTimeMs?: number

  /**
   * Minimum visibility ratio (0.0 - 1.0) required to consider
   * the component "visible".
   *
   * @defaultValue `0.8`
   */
  minVisibleRatio?: number

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
   * When provided, keeps tap tracking enabled unless `trackTaps` is explicitly `false`.
   *
   * @defaultValue `undefined`
   */
  onTap?: (resolvedEntry: Entry) => void
}

type OptimizedEntrySourceProps =
  | {
      /**
       * The baseline Contentful entry to optimize and track.
       * For optimized entries, the component resolves variants. For non-optimized entries,
       * the entry is passed through unchanged.
       */
      baselineEntry: Entry
      entryId?: never
      entryQuery?: never
    }
  | {
      baselineEntry?: never
      /** Contentful entry ID fetched through the SDK-managed Contentful client. */
      entryId: string
      /** Per-call Contentful `getEntry()` query overrides. */
      entryQuery?: ContentfulEntryQuery
    }

/**
 * Props for the {@link OptimizedEntry} component.
 *
 * @public
 */
export type OptimizedEntryProps = OptimizedEntrySharedProps & OptimizedEntrySourceProps

function resolveTapsEnabled(
  trackTaps: boolean | undefined,
  onTap: ((resolvedEntry: Entry) => void) | undefined,
  globalTaps: boolean,
): boolean {
  if (trackTaps !== undefined) return trackTaps
  if (onTap) return true
  return globalTaps
}

function resolveLoadingFallback(
  loadingFallback: OptimizedEntryLoadingFallback | undefined,
): ReactNode {
  if (typeof loadingFallback === 'function') {
    return loadingFallback()
  }

  return loadingFallback
}

function resolveErrorFallback(
  errorFallback: OptimizedEntryErrorFallback | undefined,
  error: Error,
): ReactNode {
  if (typeof errorFallback === 'function') {
    return errorFallback(error)
  }

  return errorFallback
}

function renderFallback(content: ReactNode): React.JSX.Element | null {
  return content === undefined || content === null ? null : <>{content}</>
}

function resolveChildren(
  children: OptimizedEntryChildren,
  entry: Entry,
  metadata: OptimizedEntryMetadata,
): ReactNode {
  return typeof children === 'function' ? children(entry, metadata) : children
}

function resolveUseOptimizedEntryParams(
  entryProps: OptimizedEntrySourceProps,
  liveUpdates: boolean | undefined,
  onEntryError: ((error: Error) => void) | undefined,
  onEntryResolved: ((metadata: OptimizedEntryMetadata) => void) | undefined,
): UseOptimizedEntryParams {
  if (entryProps.baselineEntry !== undefined) {
    return { baselineEntry: entryProps.baselineEntry, liveUpdates, onEntryError, onEntryResolved }
  }

  return {
    entryId: entryProps.entryId,
    entryQuery: entryProps.entryQuery,
    liveUpdates,
    onEntryError,
    onEntryResolved,
  }
}

interface OptimizedEntryContentProps {
  readonly children: OptimizedEntryChildren
  readonly dwellTimeMs?: number
  readonly minVisibleRatio?: number
  readonly metadata: OptimizedEntryMetadata
  readonly onTap?: (resolvedEntry: Entry) => void
  readonly resolvedData: ResolvedData<EntrySkeletonType>
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  readonly trackTaps?: boolean
  readonly trackViews?: boolean
  readonly viewDurationUpdateIntervalMs?: number
}

function OptimizedEntryContent({
  children,
  dwellTimeMs,
  minVisibleRatio,
  metadata,
  onTap,
  resolvedData,
  style,
  testID,
  trackTaps,
  trackViews,
  viewDurationUpdateIntervalMs,
}: OptimizedEntryContentProps): React.JSX.Element {
  const interactionTracking = useInteractionTracking()
  const viewsEnabled = trackViews ?? interactionTracking.views
  const tapsEnabled = resolveTapsEnabled(trackTaps, onTap, interactionTracking.taps)

  const { onLayout } = useViewportTracking({
    entry: resolvedData.entry,
    optimizationContextId: resolvedData.optimizationContextId,
    selectedOptimization: resolvedData.selectedOptimization,
    dwellTimeMs,
    minVisibleRatio,
    viewDurationUpdateIntervalMs,
    enabled: viewsEnabled,
  })

  const { onTouchStart, onTouchEnd } = useTapTracking({
    entry: resolvedData.entry,
    optimizationContextId: resolvedData.optimizationContextId,
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
      {resolveChildren(children, resolvedData.entry, metadata)}
    </View>
  )
}

/**
 * Unified component for tracking and personalizing Contentful entries.
 *
 * Handles both optimized entries (with `nt_experiences`) and non-optimized
 * entries. For optimized entries, it resolves the correct variant based on the
 * user's profile. For all resolved entries, it tracks views and taps.
 *
 * @param props - {@link OptimizedEntryProps}
 * @returns A wrapper View with interaction tracking attached after a real entry exists.
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
 * Configure `contentful.client` on {@link OptimizationRoot} or
 * {@link OptimizationProvider} to let `entryId` fetch the baseline entry through the SDK.
 * Passing `baselineEntry` keeps manual application-owned fetching behavior unchanged.
 *
 * @example SDK-managed entry fetching
 * ```tsx
 * <OptimizedEntry entryId="hero-entry-id" entryQuery={{ locale: 'en-US' }}>
 *   {(resolvedEntry) => <HeroComponent title={resolvedEntry.fields.title} />}
 * </OptimizedEntry>
 * ```
 *
 * @example Manual baseline entry with render prop
 * ```tsx
 * <OptimizationScrollProvider>
 *   <OptimizedEntry baselineEntry={entry}>
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
 * <OptimizedEntry baselineEntry={productEntry}>
 *   <ProductCard name={productEntry.fields.name} />
 * </OptimizedEntry>
 * ```
 *
 * @example With tap handling
 * ```tsx
 * <OptimizedEntry baselineEntry={entry}>
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
  children,
  loadingFallback,
  errorFallback,
  onEntryError,
  onEntryResolved,
  dwellTimeMs,
  minVisibleRatio,
  viewDurationUpdateIntervalMs,
  style,
  testID,
  liveUpdates,
  trackViews,
  trackTaps,
  onTap,
  ...entryProps
}: OptimizedEntryProps): React.JSX.Element | null {
  const optimizedEntry = useOptimizedEntry(
    resolveUseOptimizedEntryParams(entryProps, liveUpdates, onEntryError, onEntryResolved),
  )

  if (optimizedEntry.error !== undefined) {
    return renderFallback(resolveErrorFallback(errorFallback, optimizedEntry.error))
  }

  if (optimizedEntry.entry === undefined || optimizedEntry.metadata === undefined) {
    return renderFallback(resolveLoadingFallback(loadingFallback))
  }

  return (
    <OptimizedEntryContent
      children={children}
      dwellTimeMs={dwellTimeMs}
      minVisibleRatio={minVisibleRatio}
      metadata={optimizedEntry.metadata}
      onTap={onTap}
      resolvedData={optimizedEntry.resolvedData}
      style={style}
      testID={testID}
      trackTaps={trackTaps}
      trackViews={trackViews}
      viewDurationUpdateIntervalMs={viewDurationUpdateIntervalMs}
    />
  )
}

export default OptimizedEntry

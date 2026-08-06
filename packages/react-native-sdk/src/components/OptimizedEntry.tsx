import type {
  ContentfulEntryQuery,
  EntryFor,
  ManagedEntryDescriptor,
  OptimizedEntryMetadata,
  ResolvedData,
} from '@contentful/optimization-core'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import React, { type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useInteractionTracking } from '../context/InteractionTrackingContext'
import { useOptimizedEntry, type UseOptimizedEntryParams } from '../hooks/useOptimizedEntry'
import { useTapTracking } from '../hooks/useTapTracking'
import { useViewportTracking } from '../hooks/useViewportTracking'

declare class BivariantCallbacks {
  onEntryResolved(metadata: OptimizedEntryMetadata): void
  onTap(entry: Entry): void
  render(entry: Entry, metadata: OptimizedEntryMetadata): ReactNode
}

export type OptimizedEntryLoadingFallback = ReactNode | (() => ReactNode)
export type OptimizedEntryErrorFallback = ReactNode | ((error: Error) => ReactNode)
export type OptimizedEntryRenderProp<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = (resolvedEntry: EntryFor<S, M, L>, metadata: OptimizedEntryMetadata<S, M, L>) => ReactNode
export type OptimizedEntryChildren<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = ReactNode | OptimizedEntryRenderProp<S, M, L>

/**
 * Shared props for the {@link OptimizedEntry} component.
 *
 * @public
 */
export interface OptimizedEntrySharedProps<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> {
  /**
   * Content to render. Accepts either a render prop or static children.
   * Empty variants omit this content while retaining the tracking View.
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
  children: OptimizedEntryChildren<S, M, L>

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
   * Callback invoked when entry resolution completes with tracking ready, including empty variants.
   */
  onEntryResolved?: (metadata: OptimizedEntryMetadata<S, M, L>) => void

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
  onTap?: (resolvedEntry: EntryFor<S, M, L>) => void
}

export type OptimizedEntrySourceProps<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> =
  | {
      /**
       * The baseline Contentful entry to optimize and track.
       * For optimized entries, the component resolves variants. For non-optimized entries,
       * the entry is passed through unchanged.
       */
      baselineEntry: Entry<S, M, L>
      entryId?: never
      entryQuery?: never
      managedEntry?: never
    }
  | {
      baselineEntry?: never
      /** Contentful entry ID fetched through the SDK-managed Contentful client. */
      entryId: string
      /** Per-call Contentful `getEntry()` query overrides. */
      entryQuery?: ContentfulEntryQuery
      managedEntry?: never
    }
  | {
      baselineEntry?: never
      entryId?: never
      entryQuery?: never
      /** Managed Contentful entry descriptor fetched through the SDK-managed client. */
      managedEntry: Exclude<ManagedEntryDescriptor, string>
    }

type OptimizedEntryBaselineProps<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode,
> = OptimizedEntrySharedProps<S, M, L> & {
  baselineEntry: Entry<S, M, L>
  entryId?: never
  entryQuery?: never
  managedEntry?: never
}

type OptimizedEntryManagedProps<
  S extends EntrySkeletonType,
  L extends LocaleCode,
> = OptimizedEntrySharedProps<S, undefined, L> &
  (
    | {
        baselineEntry?: never
        entryId: string
        entryQuery?: ContentfulEntryQuery
        managedEntry?: never
      }
    | {
        baselineEntry?: never
        entryId?: never
        entryQuery?: never
        managedEntry: Exclude<ManagedEntryDescriptor, string>
      }
  )

/**
 * Props for the {@link OptimizedEntry} component.
 *
 * @public
 */
export type OptimizedEntryProps<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = OptimizedEntryBaselineProps<S, M, L> | OptimizedEntryManagedProps<S, L>

type OptimizedEntryImplementationProps = Omit<
  OptimizedEntrySharedProps,
  'children' | 'onEntryResolved' | 'onTap'
> & {
  children: ReactNode | BivariantCallbacks['render']
  onEntryResolved?: BivariantCallbacks['onEntryResolved']
  onTap?: BivariantCallbacks['onTap']
} & OptimizedEntrySourceProps

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
      {resolvedData.isEmptyVariant === true
        ? null
        : resolveChildren(children, resolvedData.entry, metadata)}
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
 * Empty variants retain the tracking View and resolution callbacks but omit consumer content.
 *
 * Configure `contentful.client` on {@link OptimizationRoot} or
 * {@link OptimizationProvider} to let `entryId` or `managedEntry` fetch the baseline entry through
 * the SDK.
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
export function OptimizedEntry<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(props: OptimizedEntryBaselineProps<S, M, L>): React.JSX.Element | null
export function OptimizedEntry<
  S extends EntrySkeletonType = EntrySkeletonType,
  L extends LocaleCode = LocaleCode,
>(props: OptimizedEntryManagedProps<S, L>): React.JSX.Element | null
export function OptimizedEntry(props: OptimizedEntryProps): React.JSX.Element | null
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
}: OptimizedEntryImplementationProps): React.JSX.Element | null {
  const optimizedEntryParams: UseOptimizedEntryParams = {
    ...entryProps,
    liveUpdates,
    onEntryError,
    onEntryResolved,
  }
  const optimizedEntry = useOptimizedEntry(optimizedEntryParams)

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

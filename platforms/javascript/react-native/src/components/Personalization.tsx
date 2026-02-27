import type { ResolvedData, SelectedPersonalizationArray } from '@contentful/optimization-core'
import type { Entry, EntrySkeletonType } from 'contentful'
import React, { useEffect, useMemo, useState, type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useLiveUpdates } from '../context/LiveUpdatesContext'
import { useOptimization } from '../context/OptimizationContext'
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
   * @defaultValue 2000
   */
  viewTimeMs?: number

  /**
   * Minimum visibility ratio (0.0 - 1.0) required to consider
   * the component "visible".
   *
   * @defaultValue 0.8
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
   * Whether this component should react to personalization state changes in real-time.
   * When `undefined`, inherits from the `liveUpdates` prop on {@link OptimizationRoot}.
   * When `false` (or inherited as `false`), the component locks to the first variant
   * it receives, preventing UI flashing when user actions change their qualification.
   * When `true`, the component updates immediately when personalizations change.
   *
   * @remarks
   * Live updates are always enabled when the preview panel is open,
   * regardless of this setting.
   *
   * @defaultValue undefined
   */
  liveUpdates?: boolean
}

/**
 * Tracks views of personalized Contentful entry components and resolves variants
 * based on the user's profile and active personalizations.
 *
 * @param props - Component props
 * @returns A wrapper View with viewport tracking attached
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
 *
 * @example Custom Thresholds
 * ```tsx
 * <Personalization
 *   baselineEntry={entry}
 *   viewTimeMs={3000}
 *   threshold={0.9}
 * >
 *   {(resolvedEntry) => <YourComponent data={resolvedEntry.fields} />}
 * </Personalization>
 * ```
 *
 * @example Live Updates
 * ```tsx
 * <Personalization baselineEntry={entry} liveUpdates={true}>
 *   {(resolvedEntry) => <DynamicComponent data={resolvedEntry.fields} />}
 * </Personalization>
 * ```
 *
 * @see {@link Analytics} for tracking non-personalized entries
 * @see {@link OptimizationRoot} for configuring global live updates
 *
 * @public
 */
export function Personalization({
  baselineEntry,
  children,
  viewTimeMs,
  threshold,
  style,
  testID,
  liveUpdates,
}: PersonalizationProps): React.JSX.Element {
  const optimization = useOptimization()
  const liveUpdatesContext = useLiveUpdates()

  // Determine if live updates should be enabled for this component:
  // 1. Preview panel visible always enables live updates (highest priority)
  // 2. Per-component liveUpdates prop overrides global setting
  // 3. Global liveUpdates from OptimizationRoot
  // 4. Default: lock on first non-undefined value
  const shouldLiveUpdate =
    liveUpdatesContext?.previewPanelVisible === true ||
    (liveUpdates ?? liveUpdatesContext?.globalLiveUpdates ?? false)

  // Track personalization state with lock-on-first-value behavior
  // When shouldLiveUpdate is false, we only accept the first non-undefined value
  const [lockedPersonalizations, setLockedPersonalizations] = useState<
    SelectedPersonalizationArray | undefined
  >(undefined)

  useEffect(() => {
    const subscription = optimization.states.personalizations.subscribe((p) => {
      if (shouldLiveUpdate) {
        // Live updates enabled - always update state
        setLockedPersonalizations(p)
      } else if (lockedPersonalizations === undefined && p !== undefined) {
        // First non-undefined value - lock it
        setLockedPersonalizations(p)
      }
      // Otherwise ignore updates (we're locked to the initial value)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [optimization, shouldLiveUpdate, lockedPersonalizations])

  const resolvedData: ResolvedData<EntrySkeletonType> = useMemo(
    () => optimization.personalization.personalizeEntry(baselineEntry, lockedPersonalizations),
    [baselineEntry, optimization, lockedPersonalizations],
  )

  const { onLayout } = useViewportTracking({
    entry: resolvedData.entry,
    personalization: resolvedData.personalization,
    threshold,
    viewTimeMs,
  })

  return (
    <View style={style} onLayout={onLayout} testID={testID}>
      {children(resolvedData.entry)}
    </View>
  )
}

export default Personalization

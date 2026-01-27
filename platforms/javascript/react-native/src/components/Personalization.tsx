import type { ResolvedData, SelectedPersonalizationArray } from '@contentful/optimization-core'
import type { Entry, EntrySkeletonType } from 'contentful'
import React, { useEffect, useMemo, useState, type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useLiveUpdates } from '../context/LiveUpdatesContext'
import { useOptimization } from '../context/OptimizationContext'
import { useViewportTracking } from '../hooks/useViewportTracking'

export interface PersonalizationProps {
  /**
   * The baseline Contentful entry fetched with { include: 10 }.
   * Must include nt_experiences field with linked personalization data.
   *
   * @example
   * ```typescript
   * const baselineEntry = await contentful.getEntry('hero-baseline-id', {
   *   include: 10  // Required to load all variant data
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
   * @default 2000 (2 seconds)
   */
  viewTimeMs?: number

  /**
   * Minimum visibility ratio (0.0 - 1.0) required to consider
   * component "visible".
   *
   * @default 0.8 (80% of the component must be visible in viewport)
   */
  threshold?: number

  /**
   * Optional style prop for the wrapper View
   */
  style?: StyleProp<ViewStyle>

  /**
   * Optional testID for testing purposes
   */
  testID?: string

  /**
   * Whether this component should react to personalization state changes in real-time.
   * When undefined, inherits from OptimizationRoot's liveUpdates setting.
   * When false (or inherited as false), the component "locks" to the first variant
   * it receives, preventing UI flashing when user actions change their qualification.
   * When true, the component updates immediately when personalizations change.
   *
   * Note: Live updates are always enabled when the preview panel is open,
   * regardless of this setting.
   *
   * @default undefined (inherits from OptimizationRoot)
   */
  liveUpdates?: boolean
}

/**
 * Personalization Component
 *
 * Tracks views of personalized Contentful entry components (content entries in your CMS).
 * This component handles variant resolution and automatically tracks component views when
 * the entry meets visibility and time thresholds.
 *
 * **Important:** "Component tracking" refers to tracking Contentful entry components,
 * NOT React Native UI components. The term "component" comes from Contentful's
 * terminology for personalized content entries.
 *
 * For nested personalized entries, customers should handle nesting logic in their own
 * implementation by wrapping each nested entry in its own `<Personalization>` component.
 * This gives full control over how nested content is detected and rendered.
 *
 * @example Basic Usage
 * ```tsx
 * import { Personalization } from '@contentful/optimization-react-native'
 * import { createClient } from 'contentful'
 *
 * const contentful = createClient({ ... })
 * const baselineEntry = await contentful.getEntry('hero-baseline-id', {
 *   include: 10  // Required to load all variant data
 * })
 *
 * <ScrollProvider>
 *   <Personalization baselineEntry={baselineEntry}>
 *     {(resolvedEntry) => (
 *       <HeroComponent
 *         title={resolvedEntry.fields.title}
 *         image={resolvedEntry.fields.image}
 *       />
 *     )}
 *   </Personalization>
 * </ScrollProvider>
 * ```
 *
 * @example Custom Thresholds
 * ```tsx
 * <Personalization
 *   baselineEntry={entry}
 *   viewTimeMs={3000}      // Track after 3s visible
 *   threshold={0.9}        // Require 90% visibility
 * >
 *   {(resolvedEntry) => <YourComponent data={resolvedEntry.fields} />}
 * </Personalization>
 * ```
 *
 * @example Live Updates for a Specific Component
 * ```tsx
 * <Personalization
 *   baselineEntry={entry}
 *   liveUpdates={true}     // Enable live updates for this component only
 * >
 *   {(resolvedEntry) => <DynamicComponent data={resolvedEntry.fields} />}
 * </Personalization>
 * ```
 *
 * @example Customer-Controlled Nested Content
 * ```tsx
 * function renderNestedContent(entry: Entry): React.JSX.Element {
 *   return (
 *     <Personalization baselineEntry={entry}>
 *       {(resolvedEntry) => {
 *         const nestedEntries = resolvedEntry.fields.nested as Entry[] | undefined
 *         return (
 *           <View>
 *             <Text>{resolvedEntry.fields.title}</Text>
 *             {nestedEntries?.map((nestedEntry) => (
 *               <View key={nestedEntry.sys.id}>
 *                 {renderNestedContent(nestedEntry)}
 *               </View>
 *             ))}
 *           </View>
 *         )
 *       }}
 *     </Personalization>
 *   )
 * }
 * ```
 *
 * @remarks
 * - Must be used within an OptimizationProvider
 * - Must be used within a ScrollProvider
 * - Tracks only once per component instance
 * - Default: tracks when 80% visible for 2000ms
 * - Handles non-personalized entries gracefully (returns baseline)
 * - By default, locks to first variant to prevent UI flashing
 * - Live updates always enabled when preview panel is open
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

import type { ResolvedData } from '@contentful/optimization-core'
import type { Entry, EntrySkeletonType } from 'contentful'
import React, { useMemo, type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
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
 */
export function Personalization({
  baselineEntry,
  children,
  viewTimeMs,
  threshold,
  style,
  testID,
}: PersonalizationProps): React.JSX.Element {
  const optimization = useOptimization()

  const resolvedData: ResolvedData<EntrySkeletonType> = useMemo(
    () => optimization.personalization.personalizeEntry(baselineEntry),
    [baselineEntry, optimization],
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

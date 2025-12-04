import type { ResolvedData } from '@contentful/optimization-core'
import type { Entry, EntrySkeletonType } from 'contentful'
import React, { useMemo, type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useOptimization } from '../context/OptimizationContext'
import { useViewportTracking } from '../hooks/useViewportTracking'

interface NestedEntry extends Entry {
  fields: Entry['fields'] & {
    nested?: Entry[]
  }
}

export interface PersonalizationProps {
  /**
   * The baseline Contentful entry fetched with { include: 10 }.
   * Must include nt_experiences field with linked personalization data.
   * May contain a `nested` field with child entries that are also personalized.
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
   * Render prop that receives the resolved variant entry and optional nested children.
   * Called with the baseline entry if no personalization matches,
   * or with the selected variant entry if personalization applies.
   *
   * @param resolvedEntry - The entry to display (baseline or variant)
   * @param nestedChildren - Pre-rendered nested personalization components (if any)
   * @returns ReactNode to render
   *
   * @example Basic usage without nesting
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
   *
   * @example With nested entries
   * ```tsx
   * <Personalization baselineEntry={pageEntry}>
   *   {(resolvedEntry, nestedChildren) => (
   *     <View>
   *       <Text>{resolvedEntry.fields.title}</Text>
   *       <View style={styles.sections}>
   *         {nestedChildren}
   *       </View>
   *     </View>
   *   )}
   * </Personalization>
   * ```
   */
  children: (resolvedEntry: Entry, nestedChildren?: ReactNode) => ReactNode

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
   * Current nesting depth (used internally for tracking)
   * @internal
   */
  depth?: number
}

/**
 * Personalization Component
 *
 * Tracks views of personalized Contentful entry components (content entries in your CMS).
 * This component handles variant resolution and automatically tracks component views when
 * the entry meets visibility and time thresholds.
 *
 * Supports recursive personalization of Contentful entries that may contain nested
 * personalized entries. When entries have a `nested` field with child entries, this
 * component resolves personalization at each level and tracks views independently.
 *
 * **Important:** "Component tracking" refers to tracking Contentful entry components,
 * NOT React Native UI components. The term "component" comes from Contentful's
 * terminology for personalized content entries.
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
 * @example With Nested Content
 * ```tsx
 * <ScrollProvider>
 *   <Personalization baselineEntry={pageEntry}>
 *     {(resolvedEntry, nestedChildren) => (
 *       <View>
 *         <Text>{resolvedEntry.fields.title}</Text>
 *         <View style={styles.sections}>
 *           {nestedChildren}
 *         </View>
 *       </View>
 *     )}
 *   </Personalization>
 * </ScrollProvider>
 * ```
 *
 * @remarks
 * - Must be used within an OptimizationProvider
 * - Must be used within a ScrollProvider
 * - Tracks only once per component instance
 * - Default: tracks when 80% visible for 2000ms
 * - Handles non-personalized entries gracefully (returns baseline)
 * - Tracks views independently for each nesting level
 * - Each nested entry resolves its own personalization independently
 * - Supports unlimited nesting depth
 * - Child entries are rendered via the `nested` field on the resolved entry
 */
export function Personalization({
  baselineEntry,
  children,
  viewTimeMs,
  threshold,
  style,
  testID,
  depth = 0,
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

  const { entry: resolvedEntry } = resolvedData as { entry: NestedEntry }
  const { fields } = resolvedEntry

  const nestedChildren = useMemo(() => {
    const { nested: nestedEntries } = fields
    if (!nestedEntries || !Array.isArray(nestedEntries) || nestedEntries.length === 0) {
      return null
    }

    return nestedEntries.map((nestedEntry, index) => (
      <Personalization
        key={nestedEntry.sys.id}
        baselineEntry={nestedEntry}
        viewTimeMs={viewTimeMs}
        threshold={threshold}
        depth={depth + 1}
        testID={testID ? `${testID}-nested-${index}` : undefined}
      >
        {children}
      </Personalization>
    ))
  }, [fields, children, viewTimeMs, threshold, depth, testID])

  return (
    <View style={style} onLayout={onLayout} testID={testID}>
      {children(resolvedData.entry, nestedChildren)}
    </View>
  )
}

export default Personalization

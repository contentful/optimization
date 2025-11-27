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

export interface NestedPersonalizationProps {
  /**
   * The baseline Contentful entry fetched with { include: 10 }.
   * Must include nt_experiences field with linked personalization data.
   * May contain a `nested` field with child entries that are also personalized.
   */
  baselineEntry: Entry

  /**
   * Render prop that receives the resolved variant entry and any nested children.
   * Called with the baseline entry if no personalization matches,
   * or with the selected variant entry if personalization applies.
   *
   * @param resolvedEntry - The entry to display (baseline or variant)
   * @param nestedChildren - Pre-rendered nested personalization components (if any)
   * @returns ReactNode to render
   *
   * @example
   * ```tsx
   * <NestedPersonalization baselineEntry={entry}>
   *   {(resolvedEntry, nestedChildren) => (
   *     <View>
   *       <Text>{resolvedEntry.fields.text}</Text>
   *       {nestedChildren}
   *     </View>
   *   )}
   * </NestedPersonalization>
   * ```
   */
  children: (resolvedEntry: Entry, nestedChildren: ReactNode) => ReactNode

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
 * NestedPersonalization Component
 *
 * Handles recursive personalization of Contentful entries that may contain nested
 * personalized entries. This component resolves personalization at each level
 * and tracks views independently for each entry in the hierarchy.
 *
 * Use this component when your Contentful entries have reference fields to other
 * entries that may also be personalized (e.g., a page with personalized sections,
 * each section containing personalized components).
 *
 * @example Basic Usage with Nested Content
 * ```tsx
 * import { NestedPersonalization, ScrollProvider } from '@contentful/optimization-react-native'
 *
 * <ScrollProvider>
 *   <NestedPersonalization baselineEntry={pageEntry}>
 *     {(resolvedEntry, nestedChildren) => (
 *       <View>
 *         <Text>{resolvedEntry.fields.title}</Text>
 *         <View style={styles.sections}>
 *           {nestedChildren}
 *         </View>
 *       </View>
 *     )}
 *   </NestedPersonalization>
 * </ScrollProvider>
 * ```
 *
 * @remarks
 * - Must be used within an OptimizationProvider
 * - Must be used within a ScrollProvider
 * - Tracks views independently for each nesting level
 * - Each nested entry resolves its own personalization independently
 * - Supports unlimited nesting depth (tested with 3+ levels)
 * - Child entries are rendered via the `nested` field on the resolved entry
 */
export function NestedPersonalization({
  baselineEntry,
  children,
  viewTimeMs,
  threshold,
  style,
  testID,
  depth = 0,
}: NestedPersonalizationProps): React.JSX.Element {
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

  const resolvedEntry = resolvedData.entry as NestedEntry

  const nestedChildren = useMemo(() => {
    const nestedEntries = resolvedEntry.fields?.nested
    if (!nestedEntries || !Array.isArray(nestedEntries) || nestedEntries.length === 0) {
      return null
    }

    return nestedEntries.map((nestedEntry, index) => (
      <NestedPersonalization
        key={nestedEntry.sys?.id ?? `nested-${depth}-${index}`}
        baselineEntry={nestedEntry}
        viewTimeMs={viewTimeMs}
        threshold={threshold}
        depth={depth + 1}
        testID={testID ? `${testID}-nested-${index}` : undefined}
      >
        {children}
      </NestedPersonalization>
    ))
  }, [resolvedEntry.fields?.nested, children, viewTimeMs, threshold, depth, testID])

  return (
    <View style={style} onLayout={onLayout} testID={testID}>
      {children(resolvedData.entry, nestedChildren)}
    </View>
  )
}

export default NestedPersonalization


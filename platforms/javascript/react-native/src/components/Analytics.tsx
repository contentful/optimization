import type { Entry } from 'contentful'
import React, { type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useViewportTracking } from '../hooks/useViewportTracking'

export interface AnalyticsProps {
  /**
   * The Contentful entry to track (non-personalized content).
   * Can be any entry fetched from Contentful.
   *
   * @example
   * ```typescript
   * const productEntry = await contentful.getEntry('product-123')
   * ```
   */
  entry: Entry

  /**
   * Child components to render. The entry is NOT provided via
   * render prop since no resolution is needed.
   *
   * Use the entry directly in your components as needed.
   */
  children: ReactNode

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
 * Analytics Component
 *
 * Tracks views of non-personalized Contentful entry components (content entries in your CMS).
 * This component automatically tracks component views when the entry meets visibility
 * and time thresholds.
 *
 * **Important:** "Component tracking" refers to tracking Contentful entry components,
 * NOT React Native UI components. The term "component" comes from Contentful's
 * terminology for content entries.
 *
 * Use this component for standard Contentful entries you want to track views on
 * (products, articles, etc.) that are NOT personalized. For personalized entries,
 * use the `<Personalization />` component instead.
 *
 * @example Basic Usage
 * ```tsx
 * import { Analytics } from '@contentful/optimization-react-native'
 * import { createClient } from 'contentful'
 *
 * const contentful = createClient({ ... })
 * const productEntry = await contentful.getEntry('product-123')
 *
 * <ScrollProvider>
 *   <Analytics entry={productEntry}>
 *     <ProductCard
 *       name={productEntry.fields.name}
 *       price={productEntry.fields.price}
 *     />
 *   </Analytics>
 * </ScrollProvider>
 * ```
 *
 * @example Custom Thresholds
 * ```tsx
 * <Analytics
 *   entry={articleEntry}
 *   viewTimeMs={1500}    // Track after 1.5s visible
 *   threshold={0.9}      // Require 90% visibility
 * >
 *   <ArticleCard data={articleEntry.fields} />
 * </Analytics>
 * ```
 *
 * @remarks
 * - Must be used within an OptimizationProvider
 * - Must be used within a ScrollProvider
 * - Tracks only once per component instance
 * - Default: tracks when 80% visible for 2000ms
 * - Sets variantIndex to 0 (indicates non-personalized/baseline content)
 * - Sets experienceId to undefined (no personalization active)
 *
 * @see {@link Personalization} for tracking personalized entries
 */
export function Analytics({
  entry,
  children,
  viewTimeMs,
  threshold,
  style,
  testID,
}: AnalyticsProps): React.JSX.Element {
  // Set up viewport tracking - the hook extracts tracking metadata from the entry
  const { onLayout } = useViewportTracking({
    entry,
    threshold,
    viewTimeMs,
  })

  return (
    <View style={style} onLayout={onLayout} testID={testID}>
      {children}
    </View>
  )
}

export default Analytics

import type { Entry } from 'contentful'
import React, { type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
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
}

/**
 * Tracks views of non-personalized Contentful entry components (content entries).
 *
 * Use this component for standard Contentful entries you want analytics on
 * (products, articles, etc.) that are not personalized.
 *
 * @param props - Component props
 * @returns A wrapper View with viewport tracking attached
 *
 * @remarks
 * Must be used within an {@link OptimizationProvider}. Works with or without a
 * {@link ScrollProvider} — when outside a ScrollProvider, screen dimensions are
 * used instead. Tracks with `variantIndex: 0` and no `experienceId` to indicate
 * baseline/non-personalized content.
 *
 * @example Basic Usage
 * ```tsx
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
 *   viewTimeMs={1500}
 *   threshold={0.9}
 * >
 *   <ArticleCard data={articleEntry.fields} />
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

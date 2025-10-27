import React, { type ReactNode } from 'react'
import { View, type ViewStyle } from 'react-native'
import { useViewportTracking } from '../hooks/useViewportTracking'

export interface OptimizationTrackedViewProps {
  /**
   * Unique identifier for the component being tracked
   */
  componentId: string

  /**
   * Optional experience ID associated with this component
   */
  experienceId?: string

  /**
   * The variant index being displayed (0-based)
   */
  variantIndex: number

  /**
   * Children to render inside the tracked view
   */
  children: ReactNode

  /**
   * Optional style to apply to the wrapper View
   */
  style?: ViewStyle

  /**
   * Visibility threshold (0-1). Defaults to 1.0 (fully visible)
   * - 0.0: Track when any part is visible
   * - 0.5: Track when 50% is visible
   * - 1.0: Track when fully visible
   */
  threshold?: number
}

/**
 * OptimizationTrackedView Component
 *
 * Automatically tracks when a component enters the viewport using the Optimization
 * analytics system. The component will track once when it becomes fully visible.
 *
 * @example
 * ```tsx
 * <OptimizationProvider instance={optimizationInstance}>
 *   <ScrollProvider>
 *     <OptimizationTrackedView
 *       componentId="hero-banner"
 *       experienceId="exp-123"
 *       variantIndex={0}
 *     >
 *       <YourPersonalizedContent />
 *     </OptimizationTrackedView>
 *   </ScrollProvider>
 * </OptimizationProvider>
 * ```
 *
 * @remarks
 * - Must be used within an OptimizationProvider
 * - Must be used within a ScrollProvider
 * - Tracks only once per component instance
 * - Requires the component to be fully visible by default (threshold=1.0)
 */
export function OptimizationTrackedView({
  componentId,
  experienceId,
  variantIndex,
  children,
  style,
  threshold = 1.0,
}: OptimizationTrackedViewProps): React.JSX.Element {
  const { onLayout } = useViewportTracking({
    componentId,
    experienceId,
    variantIndex,
    threshold,
  })

  return (
    <View style={style} onLayout={onLayout}>
      {children}
    </View>
  )
}

export default OptimizationTrackedView

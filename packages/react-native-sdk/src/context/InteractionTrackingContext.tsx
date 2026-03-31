import React, { createContext, useContext, useMemo, type ReactNode } from 'react'

/**
 * Supported entry interaction types for React Native.
 *
 * @remarks
 * Mirrors the web SDK's `EntryInteraction` but uses `taps` instead of `clicks`
 * (RN terminology) and omits `hovers` (no mouse in RN).
 *
 * @public
 */
export type EntryInteraction = 'views' | 'taps'

/**
 * Auto-tracking configuration for entry interactions, mirroring the web SDK's
 * `autoTrackEntryInteraction` pattern.
 *
 * @remarks
 * Omitted keys fall back to their defaults: `views` defaults to `true`,
 * `taps` defaults to `false`.
 *
 * @public
 */
export type TrackEntryInteractionOptions = Partial<Record<EntryInteraction, boolean>>

/**
 * Resolved interaction tracking state provided to descendant components.
 *
 * @internal
 */
export interface InteractionTrackingContextValue {
  /** Whether view tracking is enabled globally. */
  views: boolean
  /** Whether tap tracking is enabled globally. */
  taps: boolean
}

const DEFAULT_VIEWS = true
const DEFAULT_TAPS = false

const InteractionTrackingContext = createContext<InteractionTrackingContextValue>({
  views: DEFAULT_VIEWS,
  taps: DEFAULT_TAPS,
})

/**
 * Returns the resolved interaction tracking configuration from the nearest
 * `InteractionTrackingProvider`.
 *
 * @returns The resolved interaction tracking state with `views` and `taps` booleans.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { views, taps } = useInteractionTracking()
 *   return <Text>Views: {String(views)}, Taps: {String(taps)}</Text>
 * }
 * ```
 *
 * @public
 */
export function useInteractionTracking(): InteractionTrackingContextValue {
  return useContext(InteractionTrackingContext)
}

/**
 * @internal
 */
interface InteractionTrackingProviderProps {
  trackEntryInteraction?: TrackEntryInteractionOptions
  children: ReactNode
}

/**
 * Resolves entry interaction tracking configuration and provides it to
 * {@link OptimizedEntry} components.
 *
 * @param props - Provider props.
 * @returns A context provider wrapping the children.
 *
 * @remarks
 * Typically wrapped by {@link OptimizationRoot} -- not used directly.
 * Resolves partial `trackEntryInteraction` options against defaults
 * (`views: true`, `taps: false`).
 *
 * @internal
 */
export function InteractionTrackingProvider({
  trackEntryInteraction,
  children,
}: InteractionTrackingProviderProps): React.JSX.Element {
  const value = useMemo<InteractionTrackingContextValue>(
    () => ({
      views: trackEntryInteraction?.views ?? DEFAULT_VIEWS,
      taps: trackEntryInteraction?.taps ?? DEFAULT_TAPS,
    }),
    [trackEntryInteraction?.views, trackEntryInteraction?.taps],
  )

  return (
    <InteractionTrackingContext.Provider value={value}>
      {children}
    </InteractionTrackingContext.Provider>
  )
}

export default InteractionTrackingContext

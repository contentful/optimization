import React, { createContext, useContext, useState, type ReactNode } from 'react'

/**
 * @internal
 */
interface LiveUpdatesContextValue {
  globalLiveUpdates: boolean
  previewPanelVisible: boolean
  setPreviewPanelVisible: (visible: boolean) => void
}

const LiveUpdatesContext = createContext<LiveUpdatesContextValue | null>(null)

/**
 * Returns the live updates configuration from the nearest {@link LiveUpdatesProvider}.
 *
 * @returns The live updates context value, or `null` if not within a provider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const liveUpdates = useLiveUpdates()
 *   const isLive = liveUpdates?.globalLiveUpdates ?? false
 *   return <Text>{isLive ? 'Live' : 'Locked'}</Text>
 * }
 * ```
 *
 * @public
 */
export function useLiveUpdates(): LiveUpdatesContextValue | null {
  return useContext(LiveUpdatesContext)
}

/**
 * @internal
 */
interface LiveUpdatesProviderProps {
  globalLiveUpdates?: boolean
  children: ReactNode
}

/**
 * Manages live updates configuration for {@link Personalization} components.
 *
 * @param props - Provider props.
 * @returns A context provider wrapping the children.
 *
 * @remarks
 * Typically wrapped by {@link OptimizationRoot} — not used directly. Tracks the global
 * live updates setting and preview panel visibility state.
 *
 * @internal
 */
export function LiveUpdatesProvider({
  globalLiveUpdates = false,
  children,
}: LiveUpdatesProviderProps): React.JSX.Element {
  const [previewPanelVisible, setPreviewPanelVisible] = useState(false)

  return (
    <LiveUpdatesContext.Provider
      value={{
        globalLiveUpdates,
        previewPanelVisible,
        setPreviewPanelVisible,
      }}
    >
      {children}
    </LiveUpdatesContext.Provider>
  )
}

export default LiveUpdatesContext

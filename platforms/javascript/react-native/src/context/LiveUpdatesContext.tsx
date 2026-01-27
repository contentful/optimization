import React, { createContext, useContext, useState, type ReactNode } from 'react'

interface LiveUpdatesContextValue {
  /**
   * Whether live updates are enabled globally via OptimizationRoot.
   * When true, all Personalization components will immediately react to state changes.
   */
  globalLiveUpdates: boolean

  /**
   * Whether the preview panel is currently visible.
   * When true, live updates are enabled regardless of other settings.
   */
  previewPanelVisible: boolean

  /**
   * Sets the preview panel visibility state.
   * Called by PreviewPanelOverlay when the modal opens/closes.
   */
  setPreviewPanelVisible: (visible: boolean) => void
}

const LiveUpdatesContext = createContext<LiveUpdatesContextValue | null>(null)

/**
 * Hook to access live updates configuration.
 * Returns context values for determining if live updates should be enabled.
 *
 * @returns The live updates context value, or null if not within a provider
 */
export function useLiveUpdates(): LiveUpdatesContextValue | null {
  return useContext(LiveUpdatesContext)
}

interface LiveUpdatesProviderProps {
  /**
   * Whether live updates are enabled globally.
   * Defaults to false (lock on first value behavior).
   */
  globalLiveUpdates?: boolean

  children: ReactNode
}

/**
 * Provider that manages live updates configuration for Personalization components.
 *
 * This provider tracks:
 * - Global live updates setting from OptimizationRoot
 * - Preview panel visibility for automatic live updates during testing
 *
 * The provider should wrap the entire app content, typically done by OptimizationRoot.
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

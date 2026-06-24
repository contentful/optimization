import React, { createContext, useContext, useState, type Context, type ReactNode } from 'react'

/**
 * @internal
 */
export interface LiveUpdatesContextValue {
  globalLiveUpdates: boolean
  previewPanelVisible: boolean
  setPreviewPanelVisible: (visible: boolean) => void
}

// The preview entry point is bundled separately; both bundles must use one context.
const LIVE_UPDATES_CONTEXT_SYMBOL = Symbol.for(
  '@contentful/optimization-react-native/LiveUpdatesContext',
)

const globalContextRegistry = globalThis as typeof globalThis &
  Record<symbol, Context<LiveUpdatesContextValue | null> | undefined>

const LiveUpdatesContext =
  globalContextRegistry[LIVE_UPDATES_CONTEXT_SYMBOL] ??
  createContext<LiveUpdatesContextValue | null>(null)

globalContextRegistry[LIVE_UPDATES_CONTEXT_SYMBOL] = LiveUpdatesContext

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
export interface LiveUpdatesProviderProps {
  globalLiveUpdates?: boolean
  children: ReactNode
}

/**
 * Manages live updates configuration for {@link OptimizedEntry} components.
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

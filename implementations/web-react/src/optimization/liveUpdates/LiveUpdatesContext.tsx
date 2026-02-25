import {
  createContext,
  type JSX,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from 'react'

interface LiveUpdatesContextValue {
  globalLiveUpdates: boolean
  previewPanelVisible: boolean
  setPreviewPanelVisible: (visible: boolean) => void
}

const LiveUpdatesContext = createContext<LiveUpdatesContextValue | undefined>(undefined)

interface LiveUpdatesProviderProps extends PropsWithChildren {
  globalLiveUpdates?: boolean
}

export function LiveUpdatesProvider({
  children,
  globalLiveUpdates = false,
}: LiveUpdatesProviderProps): JSX.Element {
  const [previewPanelVisible, setPreviewPanelVisible] = useState(false)

  const value = useMemo<LiveUpdatesContextValue>(
    () => ({
      globalLiveUpdates,
      previewPanelVisible,
      setPreviewPanelVisible,
    }),
    [globalLiveUpdates, previewPanelVisible],
  )

  return <LiveUpdatesContext.Provider value={value}>{children}</LiveUpdatesContext.Provider>
}

export function useLiveUpdates(): LiveUpdatesContextValue | undefined {
  return useContext(LiveUpdatesContext)
}

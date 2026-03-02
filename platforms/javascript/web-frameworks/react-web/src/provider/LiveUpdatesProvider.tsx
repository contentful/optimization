import { PropsWithChildren, ReactElement, useContext } from 'react'
import { LiveUpdatesContext, LiveUpdatesContextValue } from '../context/LiveUpdatesContext'

export interface LiveUpdatesProviderProps extends PropsWithChildren {
  readonly globalLiveUpdates?: boolean
}

export function LiveUpdatesProvider({
  children,
  globalLiveUpdates = false,
}: LiveUpdatesProviderProps): ReactElement {
  return (
    <LiveUpdatesContext.Provider value={{ globalLiveUpdates }}>
      {children}
    </LiveUpdatesContext.Provider>
  )
}

export function useLiveUpdates(): LiveUpdatesContextValue | null {
  return useContext(LiveUpdatesContext)
}

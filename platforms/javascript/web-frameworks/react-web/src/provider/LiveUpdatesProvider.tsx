import type { PropsWithChildren, ReactElement } from 'react'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'

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

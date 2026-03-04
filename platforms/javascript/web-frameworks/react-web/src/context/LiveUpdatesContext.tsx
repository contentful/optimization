import { createContext } from 'react'

export interface LiveUpdatesContextValue {
  readonly globalLiveUpdates: boolean
}

export const LiveUpdatesContext = createContext<LiveUpdatesContextValue | null>(null)

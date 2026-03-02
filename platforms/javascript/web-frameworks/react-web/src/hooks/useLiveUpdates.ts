import { useContext } from 'react'
import { LiveUpdatesContext, LiveUpdatesContextValue } from '../context/LiveUpdatesContext'

export function useLiveUpdates(): LiveUpdatesContextValue | null {
  return useContext(LiveUpdatesContext)
}

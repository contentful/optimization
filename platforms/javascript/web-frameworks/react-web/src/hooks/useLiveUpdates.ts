import { useContext } from 'react'
import { LiveUpdatesContext, type LiveUpdatesContextValue } from '../context/LiveUpdatesContext'

export function useLiveUpdates(): LiveUpdatesContextValue | null {
  return useContext(LiveUpdatesContext)
}

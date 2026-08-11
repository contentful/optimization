import { useContext } from 'react'
import { LiveUpdatesContext, type LiveUpdatesContextValue } from '../context/LiveUpdatesContext'

export function useOptionalLiveUpdates(): LiveUpdatesContextValue | null {
  return useContext(LiveUpdatesContext)
}

export function useLiveUpdates(): LiveUpdatesContextValue {
  const context = useOptionalLiveUpdates()

  if (!context) {
    throw new Error('useLiveUpdates must be used within a LiveUpdatesProvider')
  }

  return context
}

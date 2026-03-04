import { useContext } from 'react'
import { LiveUpdatesContext, type LiveUpdatesContextValue } from '../context/LiveUpdatesContext'

export function useLiveUpdates(): LiveUpdatesContextValue {
  const context = useContext(LiveUpdatesContext)

  if (!context) {
    throw new Error('useLiveUpdates must be used within a LiveUpdatesProvider')
  }

  return context
}

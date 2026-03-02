import { useContext } from 'react'
import { LiveUpdatesContext, LiveUpdatesContextValue } from '../context/LiveUpdatesContext'

export function useLiveUpdates(): LiveUpdatesContextValue | null {
  const context = useContext(LiveUpdatesContext)

  if (!context) {
    throw new Error(
      'useLiveUpdates must be used within a LiveUpdatesProvider. ' +
        'Make sure to wrap your component tree with <LiveUpdatesProvider globalLiveUpdates={globalLiveUpdates}>.',
    )
  }

  return context
}

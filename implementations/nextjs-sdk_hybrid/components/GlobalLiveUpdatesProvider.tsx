'use client'

import { LiveUpdatesProvider, useOptimizationContext } from '@contentful/optimization-nextjs/client'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react'

interface GlobalLiveUpdatesContextValue {
  readonly globalLiveUpdates: boolean
  readonly onToggleGlobalLiveUpdates: () => void
}

const GlobalLiveUpdatesContext = createContext<GlobalLiveUpdatesContextValue | undefined>(undefined)

export function useGlobalLiveUpdatesControls(): GlobalLiveUpdatesContextValue {
  const value = useContext(GlobalLiveUpdatesContext)

  if (!value) {
    throw new Error('useGlobalLiveUpdatesControls must be used within GlobalLiveUpdatesProvider.')
  }

  return value
}

export function GlobalLiveUpdatesProvider({
  children,
}: {
  readonly children: ReactNode
}): JSX.Element {
  const { sdk, isReady } = useOptimizationContext()
  const [globalLiveUpdates, setGlobalLiveUpdates] = useState(false)
  const value = useMemo<GlobalLiveUpdatesContextValue>(
    () => ({
      globalLiveUpdates,
      onToggleGlobalLiveUpdates: () => {
        setGlobalLiveUpdates((current) => !current)
      },
    }),
    [globalLiveUpdates],
  )

  useEffect(() => {
    if (!sdk || !isReady) {
      return
    }

    const subscription = sdk.states.flag('boolean').subscribe(() => undefined)

    return () => {
      subscription.unsubscribe()
    }
  }, [isReady, sdk])

  return (
    <GlobalLiveUpdatesContext.Provider value={value}>
      <LiveUpdatesProvider globalLiveUpdates={globalLiveUpdates}>{children}</LiveUpdatesProvider>
    </GlobalLiveUpdatesContext.Provider>
  )
}

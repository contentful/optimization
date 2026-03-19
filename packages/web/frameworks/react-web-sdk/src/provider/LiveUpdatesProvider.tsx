import type { PropsWithChildren, ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import { useOptimizationContext } from '../hooks/useOptimization'

export interface LiveUpdatesProviderProps extends PropsWithChildren {
  readonly globalLiveUpdates?: boolean
}

export function LiveUpdatesProvider({
  children,
  globalLiveUpdates = false,
}: LiveUpdatesProviderProps): ReactElement {
  const { sdk, isReady } = useOptimizationContext()
  const [previewPanelVisible, setPreviewPanelVisible] = useState(false)

  useEffect(() => {
    if (!sdk || !isReady) {
      return
    }

    const sub = sdk.states.previewPanelOpen.subscribe((isOpen: boolean) => {
      setPreviewPanelVisible(isOpen)
    })

    return () => {
      sub.unsubscribe()
    }
  }, [isReady, sdk])

  return (
    <LiveUpdatesContext.Provider
      value={{ globalLiveUpdates, previewPanelVisible, setPreviewPanelVisible }}
    >
      {children}
    </LiveUpdatesContext.Provider>
  )
}

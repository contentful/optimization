import type { PropsWithChildren, ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { LiveUpdatesContext } from '../context/LiveUpdatesContext'
import { useOptimization } from '../hooks/useOptimization'

export interface LiveUpdatesProviderProps extends PropsWithChildren {
  readonly globalLiveUpdates?: boolean
}

export function LiveUpdatesProvider({
  children,
  globalLiveUpdates = false,
}: LiveUpdatesProviderProps): ReactElement {
  const optimization = useOptimization()
  const [previewPanelVisible, setPreviewPanelVisible] = useState(false)

  useEffect(() => {
    const sub = optimization.states.previewPanelOpen.subscribe((isOpen) => {
      setPreviewPanelVisible(isOpen)
    })
    return () => {
      sub.unsubscribe()
    }
  }, [optimization])

  return (
    <LiveUpdatesContext.Provider
      value={{ globalLiveUpdates, previewPanelVisible, setPreviewPanelVisible }}
    >
      {children}
    </LiveUpdatesContext.Provider>
  )
}

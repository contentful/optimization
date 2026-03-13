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
  const contentfulOptimization = useOptimization()
  const [previewPanelVisible, setPreviewPanelVisible] = useState(false)

  useEffect(() => {
    const sub = contentfulOptimization.states.previewPanelOpen.subscribe((isOpen: boolean) => {
      setPreviewPanelVisible(isOpen)
    })
    return () => {
      sub.unsubscribe()
    }
  }, [contentfulOptimization])

  return (
    <LiveUpdatesContext.Provider
      value={{ globalLiveUpdates, previewPanelVisible, setPreviewPanelVisible }}
    >
      {children}
    </LiveUpdatesContext.Provider>
  )
}

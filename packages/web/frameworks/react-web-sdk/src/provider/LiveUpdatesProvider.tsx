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
  const { sdk } = useOptimization()
  const [previewPanelVisible, setPreviewPanelVisible] = useState(false)

  useEffect(() => {
    if (sdk === undefined) return

    const sub = sdk.states.previewPanelOpen.subscribe((isOpen: boolean) => {
      setPreviewPanelVisible(isOpen)
    })
    return () => {
      sub.unsubscribe()
    }
  }, [sdk])

  return (
    <LiveUpdatesContext.Provider
      value={{ globalLiveUpdates, previewPanelVisible, setPreviewPanelVisible }}
    >
      {children}
    </LiveUpdatesContext.Provider>
  )
}

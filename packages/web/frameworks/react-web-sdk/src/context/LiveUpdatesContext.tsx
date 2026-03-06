import { createContext } from 'react'

export interface LiveUpdatesContextValue {
  readonly globalLiveUpdates: boolean
  readonly previewPanelVisible: boolean
  setPreviewPanelVisible: (visible: boolean) => void
}

export const LiveUpdatesContext = createContext<LiveUpdatesContextValue | null>(null)

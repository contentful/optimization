import { createScopedLogger } from '@contentful/optimization-web/logger'
import type { ContentfulClientApi } from 'contentful'
import {
  createContext,
  type JSX,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react'
import type { OptimizationInstance } from '../createOptimization'
import { useOptimizationState } from '../hooks/useOptimizationState'

interface LiveUpdatesContextValue {
  globalLiveUpdates: boolean
  previewPanelVisible: boolean
  togglePreviewPanel: () => void
}

const LiveUpdatesContext = createContext<LiveUpdatesContextValue | undefined>(undefined)

interface PreviewPanelConfig {
  contentful: ContentfulClientApi<undefined>
  optimization: OptimizationInstance
}

interface LiveUpdatesProviderProps extends PropsWithChildren {
  globalLiveUpdates: boolean
  previewPanel: PreviewPanelConfig
}

const PREVIEW_PANEL_TAG = 'ctfl-opt-preview-panel'
const PREVIEW_PANEL_TOGGLE_SELECTOR = 'button.toggle-drawer'
const previewPanelLogger = createScopedLogger('WebSdkReactReference:PreviewPanel')

function getPreviewPanelToggleButton(): HTMLButtonElement | null {
  const panelElement = document.querySelector(PREVIEW_PANEL_TAG)
  if (!(panelElement instanceof HTMLElement)) {
    return null
  }

  const toggleButton = panelElement.shadowRoot?.querySelector(PREVIEW_PANEL_TOGGLE_SELECTOR)
  return toggleButton instanceof HTMLButtonElement ? toggleButton : null
}

async function attachPreviewPanel(previewPanel: PreviewPanelConfig): Promise<void> {
  if (!ENABLE_PREVIEW_PANEL) {
    return
  }

  const { default: attachOptimizationPreviewPanel } =
    await import('@contentful/optimization-web-preview-panel')
  await attachOptimizationPreviewPanel({
    contentful: previewPanel.contentful,
    optimization: previewPanel.optimization,
    nonce: undefined,
  })
}

export function LiveUpdatesProvider({
  children,
  globalLiveUpdates,
  previewPanel,
}: LiveUpdatesProviderProps): JSX.Element {
  const { previewPanelAttached, previewPanelOpen } = useOptimizationState(
    previewPanel.optimization.states,
  )
  const previewPanelVisible = previewPanelAttached === true && previewPanelOpen === true

  const togglePreviewPanel = useCallback((): void => {
    const toggleButton = getPreviewPanelToggleButton()
    if (toggleButton) {
      toggleButton.click()
    }
  }, [])

  useEffect(() => {
    void attachPreviewPanel(previewPanel).catch((error: unknown) => {
      previewPanelLogger.warn('Failed to attach the Contentful Optimization preview panel.', error)
    })
  }, [previewPanel.contentful, previewPanel.optimization])

  const value = useMemo<LiveUpdatesContextValue>(
    () => ({
      globalLiveUpdates,
      previewPanelVisible,
      togglePreviewPanel,
    }),
    [globalLiveUpdates, previewPanelVisible, togglePreviewPanel],
  )

  return <LiveUpdatesContext.Provider value={value}>{children}</LiveUpdatesContext.Provider>
}

export function useLiveUpdates(): LiveUpdatesContextValue | undefined {
  return useContext(LiveUpdatesContext)
}

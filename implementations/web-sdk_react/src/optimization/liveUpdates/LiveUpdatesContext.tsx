import type attachOptimizationPreviewPanel from '@contentful/optimization-web-preview-panel'
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
type PreviewPanelAttacher = typeof attachOptimizationPreviewPanel
type PreviewPanelContentful = Parameters<PreviewPanelAttacher>[0]['contentful']

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

const previewPanelAttachments = new WeakMap<OptimizationInstance, Promise<void>>()

function getPreviewPanelToggleButton(): HTMLButtonElement | null {
  const panelElement = document.querySelector(PREVIEW_PANEL_TAG)
  if (!(panelElement instanceof HTMLElement)) {
    return null
  }

  const toggleButton = panelElement.shadowRoot?.querySelector(PREVIEW_PANEL_TOGGLE_SELECTOR)
  return toggleButton instanceof HTMLButtonElement ? toggleButton : null
}

function toPreviewPanelContentful(client: ContentfulClientApi<undefined>): PreviewPanelContentful {
  return client.withAllLocales.withoutLinkResolution.withoutUnresolvableLinks
}

async function attachPreviewPanel(previewPanel: PreviewPanelConfig): Promise<void> {
  if (!ENABLE_PREVIEW_PANEL) {
    return
  }

  const existing = previewPanelAttachments.get(previewPanel.optimization)
  if (existing) {
    await existing
    return
  }

  // Preview panel is demo-only and disabled by default for production-style builds.
  const { default: attachOptimizationPreviewPanel }: { default: PreviewPanelAttacher } =
    await import('@contentful/optimization-web-preview-panel')
  const attachment = attachOptimizationPreviewPanel({
    contentful: toPreviewPanelContentful(previewPanel.contentful),
    optimization: previewPanel.optimization,
    nonce: undefined,
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('already been attached')) {
      return
    }

    throw error
  })

  previewPanelAttachments.set(previewPanel.optimization, attachment)
  await attachment
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
    void attachPreviewPanel(previewPanel).catch(() => undefined)
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

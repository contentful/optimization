import attachOptimizationPreviewPanel from '@contentful/optimization-web-preview-panel'
import type { ContentfulClientApi } from 'contentful'
import {
  createContext,
  type JSX,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { OptimizationInstance } from '../createOptimization'

interface LiveUpdatesContextValue {
  globalLiveUpdates: boolean
  previewPanelVisible: boolean
  setPreviewPanelVisible: (visible: boolean) => void
  togglePreviewPanel: () => void
}

const LiveUpdatesContext = createContext<LiveUpdatesContextValue | undefined>(undefined)
type PreviewPanelContentful = Parameters<typeof attachOptimizationPreviewPanel>[0]['contentful']

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

function isPreviewPanelOpen(toggleButton: HTMLButtonElement): boolean {
  // TODO: Replace this class-based check with a supported preview panel open-state API.
  return toggleButton.classList.contains('opened')
}

function toPreviewPanelContentful(client: ContentfulClientApi<undefined>): PreviewPanelContentful {
  return client.withAllLocales.withoutLinkResolution.withoutUnresolvableLinks
}

async function attachPreviewPanel(previewPanel: PreviewPanelConfig): Promise<void> {
  const existing = previewPanelAttachments.get(previewPanel.optimization)
  if (existing) {
    await existing
    return
  }

  // TODO: Add a production-dead-code branch so preview panel attachment is tree-shakeable
  // in docs/reference builds and does not always pull preview panel code into customer bundles.
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
  const [previewPanelVisible, setPreviewPanelVisible] = useState(false)

  const togglePreviewPanel = useCallback((): void => {
    const toggleButton = getPreviewPanelToggleButton()
    if (toggleButton) {
      toggleButton.click()
      setPreviewPanelVisible(isPreviewPanelOpen(toggleButton))
      return
    }

    setPreviewPanelVisible((previous) => !previous)
  }, [])

  useEffect(() => {
    const observerRef: { current: MutationObserver | null } = { current: null }
    const retryTimerRef: { current: ReturnType<typeof setInterval> | null } = { current: null }
    const stoppedRef: { current: boolean } = { current: false }

    const connect = (): void => {
      const toggleButton = getPreviewPanelToggleButton()
      if (!toggleButton) {
        return
      }

      setPreviewPanelVisible(isPreviewPanelOpen(toggleButton))
      observerRef.current = new MutationObserver(() => {
        setPreviewPanelVisible(isPreviewPanelOpen(toggleButton))
      })
      observerRef.current.observe(toggleButton, { attributes: true, attributeFilter: ['class'] })
    }

    void attachPreviewPanel(previewPanel)
      .then(() => {
        if (stoppedRef.current) {
          return
        }

        connect()
        if (observerRef.current === null) {
          retryTimerRef.current = setInterval(() => {
            if (observerRef.current !== null || stoppedRef.current) {
              return
            }

            connect()
          }, 100)
        }
      })
      .catch(() => {
        setPreviewPanelVisible(false)
      })

    return () => {
      stoppedRef.current = true
      observerRef.current?.disconnect()
      if (retryTimerRef.current !== null) {
        clearInterval(retryTimerRef.current)
      }
    }
  }, [previewPanel])

  const value = useMemo<LiveUpdatesContextValue>(
    () => ({
      globalLiveUpdates,
      previewPanelVisible,
      setPreviewPanelVisible,
      togglePreviewPanel,
    }),
    [globalLiveUpdates, previewPanelVisible, togglePreviewPanel],
  )

  return <LiveUpdatesContext.Provider value={value}>{children}</LiveUpdatesContext.Provider>
}

export function useLiveUpdates(): LiveUpdatesContextValue | undefined {
  return useContext(LiveUpdatesContext)
}

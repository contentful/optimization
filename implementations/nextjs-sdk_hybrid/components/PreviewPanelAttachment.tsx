'use client'

import { appConfig } from '@/lib/config'
import { useOptimizationContext } from '@contentful/optimization-nextjs/client'
import { useEffect, type JSX } from 'react'

let previewPanelAttachmentStarted = false

export function PreviewPanelAttachment(): JSX.Element | null {
  const { isReady, sdk } = useOptimizationContext()

  useEffect(() => {
    if (
      !appConfig.previewPanelEnabled ||
      !isReady ||
      sdk === undefined ||
      previewPanelAttachmentStarted
    ) {
      return
    }

    previewPanelAttachmentStarted = true
    void Promise.all([
      import('@contentful/optimization-web-preview-panel'),
      import('@/lib/contentful-client'),
    ])
      .then(async ([{ default: attachOptimizationPreviewPanel }, { getContentfulClient }]) => {
        await attachOptimizationPreviewPanel({
          contentful: getContentfulClient(),
          nonce: undefined,
        })
      })
      .catch((error: unknown) => {
        previewPanelAttachmentStarted = false
        console.warn('Failed to attach the Contentful Optimization preview panel.', error)
      })
  }, [isReady, sdk])

  return null
}

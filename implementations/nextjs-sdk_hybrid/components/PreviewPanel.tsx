'use client'

import { appConfig } from '@/lib/config'
import { useOptimizationContext } from '@contentful/optimization-nextjs/client'
import { useEffect, type JSX } from 'react'

export function PreviewPanel(): JSX.Element | null {
  const { isReady, sdk } = useOptimizationContext()

  useEffect(() => {
    if (!appConfig.previewPanelEnabled || !isReady || sdk === undefined) {
      return
    }

    void Promise.all([
      import('@contentful/optimization-web-preview-panel'),
      import('@/lib/contentful'),
    ])
      .then(async ([{ default: attachOptimizationPreviewPanel }, { client }]) => {
        await attachOptimizationPreviewPanel({
          contentful: client,
          nonce: undefined,
        })
      })
      .catch((error: unknown) => {
        console.warn('Failed to attach the Contentful Optimization preview panel.', error)
      })
  }, [isReady, sdk])

  return null
}

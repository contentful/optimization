'use client'

import { appConfig } from '@/lib/config'
import { useOptimizationContext } from '@contentful/optimization-nextjs/client'
import { useEffect, type JSX } from 'react'

export function PreviewPanel(): JSX.Element | null {
  const { sdk } = useOptimizationContext()

  useEffect(() => {
    if (!appConfig.previewPanelEnabled || sdk === undefined) {
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
  }, [sdk])

  return null
}

'use client'

import { useOptimizationContext } from '@contentful/optimization-nextjs/client'
import { useEffect } from 'react'

export function CustomViewTracker({ componentId }: { readonly componentId: string }): null {
  const { sdk } = useOptimizationContext()

  useEffect(() => {
    if (!sdk) return
    void sdk.trackView({ componentId, viewId: crypto.randomUUID(), viewDurationMs: 0 })
  }, [sdk, componentId])

  return null
}

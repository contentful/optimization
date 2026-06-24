'use client'

import { useOptimization } from '@contentful/optimization-nextjs/client'
import { type JSX } from 'react'

export function TrackViewButton({
  children,
  componentId,
  testId,
}: {
  readonly children: string
  readonly componentId: string
  readonly testId?: string
}): JSX.Element {
  const sdk = useOptimization()

  const handleClick = (): void => {
    void sdk.trackView({ componentId, viewId: crypto.randomUUID(), viewDurationMs: 0 })
  }

  return (
    <button
      className="btn btn--secondary btn--sm"
      data-testid={testId}
      onClick={handleClick}
      type="button"
    >
      {children}
    </button>
  )
}

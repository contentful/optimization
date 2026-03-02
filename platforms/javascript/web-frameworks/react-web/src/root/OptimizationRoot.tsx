import type { PropsWithChildren, ReactElement } from 'react'

import { LiveUpdatesProvider } from '../provider/LiveUpdatesProvider'
import { OptimizationProvider } from '../provider/OptimizationProvider'
import type { OptimizationWebSdk } from '../types'

export interface OptimizationRootProps extends PropsWithChildren {
  readonly instance: OptimizationWebSdk
  readonly liveUpdates?: boolean
}

export function OptimizationRoot({
  children,
  instance,
  liveUpdates = false,
}: OptimizationRootProps): ReactElement {
  return (
    <OptimizationProvider instance={instance}>
      <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>{children}</LiveUpdatesProvider>
    </OptimizationProvider>
  )
}

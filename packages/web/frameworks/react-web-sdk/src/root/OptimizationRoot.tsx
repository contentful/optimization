import type { ReactElement } from 'react'

import { LiveUpdatesProvider } from '../provider/LiveUpdatesProvider'
import {
  OptimizationProvider,
  type OptimizationProviderProps,
} from '../provider/OptimizationProvider'

export type OptimizationRootProps = OptimizationProviderProps & {
  readonly liveUpdates?: boolean
}

export function OptimizationRoot({
  children,
  liveUpdates = false,
  ...providerProps
}: OptimizationRootProps): ReactElement {
  return (
    <OptimizationProvider {...providerProps}>
      <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>{children}</LiveUpdatesProvider>
    </OptimizationProvider>
  )
}

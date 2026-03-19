import type { ReactElement } from 'react'

import { LiveUpdatesProvider } from '../provider/LiveUpdatesProvider'
import {
  OptimizationProvider,
  type OptimizationProviderConfigProps,
} from '../provider/OptimizationProvider'

export type OptimizationRootProps = OptimizationProviderConfigProps & {
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

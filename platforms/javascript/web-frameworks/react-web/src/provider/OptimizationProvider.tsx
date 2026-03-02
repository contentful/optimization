import type { PropsWithChildren, ReactElement } from 'react'

import type { OptimizationWebSdkOrNull } from '../types'

export interface OptimizationProviderProps extends PropsWithChildren {
  readonly optimization?: OptimizationWebSdkOrNull
}

export function OptimizationProvider({ children }: OptimizationProviderProps): ReactElement {
  // Scaffold placeholder: context wiring will be implemented in follow-up tickets.
  return <>{children}</>
}

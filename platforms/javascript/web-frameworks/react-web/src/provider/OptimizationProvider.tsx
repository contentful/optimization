import type { ReactNode } from 'react'

import type { OptimizationWebSdkOrNull } from '../types'

export interface OptimizationProviderProps {
  readonly children?: ReactNode
  readonly optimization?: OptimizationWebSdkOrNull
}

export function OptimizationProvider({ children }: OptimizationProviderProps): ReactNode {
  // Scaffold placeholder: context wiring will be implemented in follow-up tickets.
  return children ?? null
}

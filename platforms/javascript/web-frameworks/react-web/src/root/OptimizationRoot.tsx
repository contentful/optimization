import type { ReactNode } from 'react'

import { OptimizationProvider } from '../provider/OptimizationProvider'
import type { OptimizationWebSdkOrNull } from '../types'

export interface OptimizationRootProps {
  readonly children?: ReactNode
  readonly optimization?: OptimizationWebSdkOrNull
}

export function OptimizationRoot({ children, optimization }: OptimizationRootProps): ReactNode {
  return <OptimizationProvider optimization={optimization}>{children}</OptimizationProvider>
}

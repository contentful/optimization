import type { PropsWithChildren, ReactElement } from 'react'

import { OptimizationProvider } from '../provider/OptimizationProvider'
import type { OptimizationWebSdkOrNull } from '../types'

export interface OptimizationRootProps extends PropsWithChildren {
  readonly optimization?: OptimizationWebSdkOrNull
}

export function OptimizationRoot({ children, optimization }: OptimizationRootProps): ReactElement {
  return <OptimizationProvider optimization={optimization}>{children}</OptimizationProvider>
}

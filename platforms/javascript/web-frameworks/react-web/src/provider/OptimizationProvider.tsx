import type { PropsWithChildren, ReactElement } from 'react'

import { OptimizationContext } from '../context/OptimizationContext'
import type { OptimizationWebSdk } from '../types'

export interface OptimizationProviderProps extends PropsWithChildren {
  readonly instance: OptimizationWebSdk
}

export function OptimizationProvider({
  children,
  instance,
}: OptimizationProviderProps): ReactElement {
  return (
    <OptimizationContext.Provider value={{ instance }}>{children}</OptimizationContext.Provider>
  )
}

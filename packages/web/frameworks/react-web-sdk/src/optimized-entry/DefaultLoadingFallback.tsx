import type { JSX, ReactNode } from 'react'

export interface DefaultLoadingFallbackProps {
  children: ReactNode
}

export function DefaultLoadingFallback({ children }: DefaultLoadingFallbackProps): JSX.Element {
  return <span data-ctfl-loading="true">{children}</span>
}

export default DefaultLoadingFallback

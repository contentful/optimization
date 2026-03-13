import type { JSX } from 'react'

export function DefaultLoadingFallback(): JSX.Element {
  return (
    <span data-ctfl-loading="true" aria-label="Loading content">
      Loading...
    </span>
  )
}

export default DefaultLoadingFallback

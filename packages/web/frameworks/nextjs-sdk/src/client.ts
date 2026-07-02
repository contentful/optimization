'use client'

import { useOptimization } from '@contentful/optimization-react-web'
import type { OptimizationData } from '@contentful/optimization-web/api-schemas'
import { hydrateOptimizationData } from '@contentful/optimization-web/bridge-support'
import { useLayoutEffect } from 'react'

export * from '@contentful/optimization-react-web'
export {
  NextAppAutoPageTracker,
  type NextAppAutoPageContext,
  type NextAppAutoPageTrackerProps,
} from '@contentful/optimization-react-web/router/next-app'
export {
  NextPagesAutoPageTracker,
  type NextPagesAutoPageContext,
  type NextPagesAutoPageTrackerProps,
} from '@contentful/optimization-react-web/router/next-pages'

export interface NextjsOptimizationStateProps {
  readonly data: OptimizationData | undefined
}

/**
 * Hydrates server-resolved Optimization data into the live client SDK.
 *
 * @deprecated Pass the server-resolved `OptimizationData` to `OptimizationRoot`
 * (or `OptimizationProvider`) via the `serverOptimizationState` prop instead.
 * The provider now renders personalized state on the server and hydrates the
 * same data into the live SDK on the client, so a separate page-level
 * hydration marker is redundant. This component remains only for setups that
 * seed the provider by configuration and hydrate page-specific data later.
 *
 * @public
 */
export function NextjsOptimizationState({ data }: NextjsOptimizationStateProps): null {
  const sdk = useOptimization()

  useLayoutEffect(() => {
    void hydrateOptimizationData(sdk, data)
  }, [data, sdk])

  return null
}

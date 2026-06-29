'use client'

import { useOptimization } from '@contentful/optimization-react-web'
import type { OptimizationData } from '@contentful/optimization-web/api-schemas'
import { hydrateOptimizationData } from '@contentful/optimization-web/bridge-support'
import { useLayoutEffect } from 'react'

export * from '@contentful/optimization-react-web'
export { isMergeTagEntry } from '@contentful/optimization-react-web/api-schemas'
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

export function NextjsOptimizationState({ data }: NextjsOptimizationStateProps): null {
  const sdk = useOptimization()

  useLayoutEffect(() => {
    void hydrateOptimizationData(sdk, data)
  }, [data, sdk])

  return null
}

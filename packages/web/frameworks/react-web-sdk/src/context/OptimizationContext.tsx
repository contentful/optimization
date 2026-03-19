import type ContentfulOptimization from '@contentful/optimization-web'
import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { createContext } from 'react'

export type OptimizationSdk = Pick<
  ContentfulOptimization,
  | 'consent'
  | 'destroy'
  | 'getFlag'
  | 'getMergeTagValue'
  | 'identify'
  | 'page'
  | 'reset'
  | 'states'
  | 'track'
  | 'trackClick'
  | 'trackView'
  | 'tracking'
> & {
  personalizeEntry: (
    entry: Entry,
    selectedPersonalizations?: SelectedPersonalizationArray,
  ) => ResolvedData<EntrySkeletonType>
}

export interface OptimizationContextValue {
  readonly sdk: OptimizationSdk | undefined
  readonly isReady: boolean
  readonly error: Error | undefined
}

export const OptimizationContext = createContext<OptimizationContextValue | null>(null)

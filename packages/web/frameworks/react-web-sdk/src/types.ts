import type ContentfulOptimization from '@contentful/optimization-web'
import type { OptimizationTrackingApi } from '@contentful/optimization-web'
import type {
  Json,
  MergeTagEntry,
  Profile,
  SelectedPersonalizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'

export interface OptimizationObservable<TValue> {
  readonly current: TValue
  readonly subscribe: (next: (value: TValue) => void) => { unsubscribe: () => void }
  readonly subscribeOnce: (next: (value: NonNullable<TValue>) => void) => {
    unsubscribe: () => void
  }
}

export interface OptimizationStates {
  readonly blockedEventStream: OptimizationObservable<unknown>
  readonly canPersonalize: OptimizationObservable<boolean>
  readonly consent: OptimizationObservable<boolean | undefined>
  readonly eventStream: OptimizationObservable<
    | {
        type?: string
        event?: string
        name?: string
        componentId?: string
      }
    | undefined
  >
  readonly flag: (name: string) => OptimizationObservable<unknown>
  readonly previewPanelAttached: OptimizationObservable<boolean>
  readonly previewPanelOpen: OptimizationObservable<boolean>
  readonly profile: OptimizationObservable<Profile | undefined>
  readonly selectedPersonalizations: OptimizationObservable<
    SelectedPersonalizationArray | undefined
  >
}

export interface OptimizationSdk {
  readonly consent: (value: boolean) => void
  readonly destroy: () => void
  readonly getFlag: (
    name: string,
    changes?: Parameters<ContentfulOptimization['getFlag']>[1],
  ) => Json
  readonly getMergeTagValue: (
    embeddedEntryNodeTarget: MergeTagEntry,
    profile?: Profile,
  ) => string | undefined
  readonly identify: (
    payload: Parameters<ContentfulOptimization['identify']>[0],
  ) => ReturnType<ContentfulOptimization['identify']>
  readonly page: (
    payload: Parameters<ContentfulOptimization['page']>[0],
  ) => ReturnType<ContentfulOptimization['page']>
  readonly personalizeEntry: (
    entry: Entry,
    selectedPersonalizations?: SelectedPersonalizationArray,
  ) => ResolvedData<EntrySkeletonType>
  readonly reset: () => void
  readonly states: OptimizationStates
  readonly tracking: OptimizationTrackingApi
  readonly track: (
    payload: Parameters<ContentfulOptimization['track']>[0],
  ) => ReturnType<ContentfulOptimization['track']>
  readonly trackClick: (
    payload: Parameters<ContentfulOptimization['trackClick']>[0],
  ) => ReturnType<ContentfulOptimization['trackClick']>
  readonly trackView: (
    payload: Parameters<ContentfulOptimization['trackView']>[0],
  ) => ReturnType<ContentfulOptimization['trackView']>
}

export type ContentfulOptimizationOrNull = ContentfulOptimization | null

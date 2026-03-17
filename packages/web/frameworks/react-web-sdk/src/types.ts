import type ContentfulOptimization from '@contentful/optimization-web'
import type {
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
  readonly track: (
    payload: Parameters<ContentfulOptimization['track']>[0],
  ) => ReturnType<ContentfulOptimization['track']>
  readonly trackView: (
    payload: Parameters<ContentfulOptimization['trackView']>[0],
  ) => ReturnType<ContentfulOptimization['trackView']>
}

export type ContentfulOptimizationOrNull = OptimizationSdk | null

export type PersonalizationEntryInput = Entry

export type AnalyticsEventInput = Parameters<ContentfulOptimization['trackView']>[0]

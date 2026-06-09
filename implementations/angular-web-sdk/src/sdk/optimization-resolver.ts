import { inject, Injectable } from '@angular/core'
import type {
  MergeTagEntry,
  SelectedOptimizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { Optimization } from './optimization'

export type { ResolvedData }

function toStringValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean')
    return `${value}`
  if (typeof value === 'symbol') return value.description ?? value.toString()
  return JSON.stringify(value)
}

function fallbackResolveEntry(entry: Entry): ResolvedData<EntrySkeletonType> {
  return { entry }
}

@Injectable({ providedIn: 'root' })
export class OptimizationResolver {
  private readonly optimization = inject(Optimization)

  resolveEntry(
    baseline: Entry,
    selectedOptimizations?: SelectedOptimizationArray,
  ): ResolvedData<EntrySkeletonType> {
    if (this.optimization.sdk === undefined) return fallbackResolveEntry(baseline)
    return this.optimization.sdk.resolveOptimizedEntry(baseline, selectedOptimizations)
  }

  getMergeTagValue(mergeTagEntry: MergeTagEntry): string {
    if (this.optimization.sdk === undefined) return ''
    return toStringValue(this.optimization.sdk.getMergeTagValue(mergeTagEntry))
  }
}

import { inject, Injectable } from '@angular/core'
import type {
  MergeTagEntry,
  SelectedOptimizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { isRecord } from '../utils'
import { NgContentfulOptimization } from './optimization'

export type { ResolvedData }

export interface EntryMeta {
  experienceId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
}

export interface ResolvedEntryView {
  resolvedEntry: Entry
  baselineId: string
  resolvedId: string
  meta: EntryMeta
  isVariant: boolean
}

function extractMeta(value: unknown): EntryMeta {
  if (!isRecord(value))
    return { experienceId: undefined, sticky: undefined, variantIndex: undefined }
  return {
    experienceId: typeof value.experienceId === 'string' ? value.experienceId : undefined,
    sticky: typeof value.sticky === 'boolean' ? value.sticky : undefined,
    variantIndex: typeof value.variantIndex === 'number' ? value.variantIndex : undefined,
  }
}

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
export class NgContentfulOptimizationResolver {
  private readonly optimization = inject(NgContentfulOptimization)

  resolveEntry(
    baseline: Entry,
    selectedOptimizations?: SelectedOptimizationArray,
  ): ResolvedData<EntrySkeletonType> {
    if (this.optimization.sdk === undefined) return fallbackResolveEntry(baseline)
    return this.optimization.sdk.resolveOptimizedEntry(baseline, selectedOptimizations)
  }

  resolveWithMeta(
    baseline: Entry,
    selectedOptimizations?: SelectedOptimizationArray,
  ): ResolvedEntryView {
    const resolved = this.resolveEntry(
      baseline,
      selectedOptimizations ?? this.optimization.selectedOptimizations(),
    )
    const { entry: resolvedEntry } = resolved
    const meta = extractMeta(resolved.selectedOptimization)
    return {
      resolvedEntry,
      baselineId: baseline.sys.id,
      resolvedId: resolvedEntry.sys.id,
      meta,
      isVariant: meta.experienceId !== undefined,
    }
  }

  getMergeTagValue(mergeTagEntry: MergeTagEntry): string {
    if (this.optimization.sdk === undefined) return ''
    return toStringValue(this.optimization.sdk.getMergeTagValue(mergeTagEntry))
  }
}

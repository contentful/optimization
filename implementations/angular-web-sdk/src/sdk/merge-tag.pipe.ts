import { inject, Pipe, type PipeTransform } from '@angular/core'
import type { MergeTagEntry } from '@contentful/optimization-web/api-schemas'
import { OptimizationResolver } from './optimization-resolver'
import { isRecord } from './utils'

function isMergeTagEntry(entry: unknown): entry is MergeTagEntry {
  if (!isRecord(entry) || !isRecord(entry.sys)) return false
  if (!isRecord(entry.sys.contentType)) return false
  if (!isRecord(entry.sys.contentType.sys)) return false
  return entry.sys.contentType.sys.id === 'nt_mergetag'
}

export { isMergeTagEntry }

@Pipe({ name: 'mergeTag' })
export class MergeTagPipe implements PipeTransform {
  private readonly resolver = inject(OptimizationResolver)

  transform(target: unknown): string {
    if (!isMergeTagEntry(target)) return '[Merge Tag]'
    return this.resolver.getMergeTagValue(target)
  }
}

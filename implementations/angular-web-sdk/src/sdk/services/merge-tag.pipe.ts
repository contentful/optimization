import { inject, Pipe, type PipeTransform } from '@angular/core'
import { isMergeTagEntry } from '../utils'
import { NgContentfulOptimizationResolver } from './optimization-resolver'

export { isMergeTagEntry }

@Pipe({ name: 'mergeTag' })
export class MergeTagPipe implements PipeTransform {
  private readonly resolver = inject(NgContentfulOptimizationResolver)

  transform(target: unknown): string {
    return this.resolver.resolveMergeTag(target)
  }
}

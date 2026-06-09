import { inject, Pipe, type PipeTransform } from '@angular/core'
import { NgContentfulOptimizationResolver } from './optimization-resolver'

@Pipe({ name: 'mergeTag' })
export class MergeTagPipe implements PipeTransform {
  private readonly resolver = inject(NgContentfulOptimizationResolver)

  transform(target: unknown): string {
    return this.resolver.resolveMergeTag(target)
  }
}

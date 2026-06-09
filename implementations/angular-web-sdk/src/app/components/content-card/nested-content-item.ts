import { Component, computed, forwardRef, inject, input } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import {
  NgContentfulOptimization,
  NgContentfulOptimizationResolver,
  isRecord,
} from '@contentful/optimization-angular'
import type { ContentfulEntry } from '../../types/contentful'

function isEntry(value: unknown): value is ContentfulEntry {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    typeof value.sys.id === 'string' &&
    isRecord(value.fields)
  )
}

@Component({
  selector: 'app-nested-content-item',
  imports: [forwardRef(() => NestedContentItem)],
  templateUrl: './nested-content-item.html',
})
export class NestedContentItem {
  readonly entry = input.required<ContentfulEntry>()

  private readonly optimization = inject(NgContentfulOptimization)
  private readonly resolver = inject(NgContentfulOptimizationResolver)

  private readonly selectedOptimizations = toSignal(this.optimization.selectedOptimizations$)

  protected readonly resolved = computed(() =>
    this.resolver.resolveWithMeta(this.entry(), this.selectedOptimizations()),
  )

  protected readonly entryText = computed(() => {
    const text: unknown = this.resolved().resolvedEntry.fields.text
    return typeof text === 'string' ? text : ''
  })

  protected readonly nestedEntries = computed(() => {
    const nested: unknown = this.resolved().resolvedEntry.fields.nested
    return Array.isArray(nested) ? nested.filter(isEntry) : []
  })
}

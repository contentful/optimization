import { Component, computed, forwardRef, inject, input } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import {
  isRecord,
  NgContentfulOptimization,
  NgContentfulOptimizationResolver,
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
  selector: 'app-nested-content',
  imports: [forwardRef(() => NestedContent)],
  templateUrl: './nested-content.html',
})
export class NestedContent {
  // inputs
  readonly entry = input.required<ContentfulEntry>()

  // injected dependencies
  private readonly optimization = inject(NgContentfulOptimization)
  private readonly resolver = inject(NgContentfulOptimizationResolver)

  // private state
  private readonly selectedOptimizations = toSignal(this.optimization.selectedOptimizations$)

  // protected state
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

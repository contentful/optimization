import { Component, computed, forwardRef, inject, input } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { Optimization, OptimizationResolver } from '@contentful/optimization-angular'
import type { ContentfulEntry } from '../../types/contentful'
import { getSelectedOptimizationMeta, isEntry } from '../../utils/type-guards'

@Component({
  selector: 'app-nested-content-item',
  imports: [forwardRef(() => NestedContentItem)],
  templateUrl: './nested-content-item.html',
})
export class NestedContentItem {
  readonly entry = input.required<ContentfulEntry>()

  private readonly optimization = inject(Optimization)
  private readonly resolver = inject(OptimizationResolver)

  protected readonly selectedOptimizations = toSignal(this.optimization.selectedOptimizations$)

  protected readonly resolved = computed(() =>
    this.resolver.resolveEntry(this.entry(), this.selectedOptimizations()),
  )

  protected readonly resolvedEntry = computed(() => this.resolved().entry as ContentfulEntry)

  protected readonly meta = computed(() =>
    getSelectedOptimizationMeta(this.resolved().selectedOptimization),
  )

  protected readonly baselineId = computed(() => this.entry().sys.id)
  protected readonly resolvedId = computed(() => this.resolvedEntry().sys.id)
  protected readonly isVariant = computed(() => this.meta().experienceId !== undefined)

  protected readonly entryText = computed(() => {
    const text: unknown = this.resolvedEntry().fields.text
    return typeof text === 'string' ? text : ''
  })

  protected readonly stickyAttr = computed(() => {
    const { sticky } = this.meta()
    return sticky === undefined ? null : String(sticky)
  })

  protected readonly variantIndexAttr = computed(() => {
    const { variantIndex } = this.meta()
    return variantIndex === undefined ? null : String(variantIndex)
  })

  protected readonly nestedEntries = computed(() => {
    const nested: unknown = this.resolvedEntry().fields.nested
    return Array.isArray(nested) ? nested.filter(isEntry) : []
  })
}

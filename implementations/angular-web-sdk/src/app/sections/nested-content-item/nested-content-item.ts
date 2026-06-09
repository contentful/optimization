import { Component, computed, forwardRef, inject, input } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { Observable } from 'rxjs'
import { fromSdkObservable, Optimization } from '../../optimization/optimization'
import { OptimizationResolver } from '../../optimization/optimization-resolver'
import type { ContentfulEntry } from '../../types/contentful'
import { isRecord } from '../../utils/type-guards'

function isEntry(value: unknown): value is ContentfulEntry {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    typeof value.sys.id === 'string' &&
    isRecord(value.fields)
  )
}

function getSelectedOptimizationMeta(value: unknown): {
  experienceId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
} {
  if (!isRecord(value))
    return { experienceId: undefined, sticky: undefined, variantIndex: undefined }
  return {
    experienceId: typeof value.experienceId === 'string' ? value.experienceId : undefined,
    sticky: typeof value.sticky === 'boolean' ? value.sticky : undefined,
    variantIndex: typeof value.variantIndex === 'number' ? value.variantIndex : undefined,
  }
}

@Component({
  selector: 'app-nested-content-item',
  imports: [forwardRef(() => NestedContentItem)],
  templateUrl: './nested-content-item.html',
})
export class NestedContentItem {
  readonly entry = input.required<ContentfulEntry>()

  private readonly optimization = inject(Optimization)
  private readonly resolver = inject(OptimizationResolver)

  protected readonly selectedOptimizations = toSignal(
    this.optimization.sdk !== undefined
      ? fromSdkObservable<SelectedOptimizationArray | undefined>(
          this.optimization.sdk.states.selectedOptimizations,
        )
      : new Observable<SelectedOptimizationArray | undefined>((sub) => {
          sub.next(undefined)
        }),
  )

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

import { Component, computed, forwardRef, inject, input } from '@angular/core'
import { isRecord, NgContentfulOptimizationResolver } from '@contentful/optimization-angular'
import type { ContentfulEntry } from '../../types/contentful'
import { buildNestedBadges, EntryBadge } from './badge'

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
  imports: [forwardRef(() => NestedContent), EntryBadge],
  templateUrl: './nested-content.html',
})
export class NestedContent {
  // inputs
  readonly entry = input.required<ContentfulEntry>()

  // injected dependencies
  private readonly resolver = inject(NgContentfulOptimizationResolver)

  // protected state
  protected readonly resolved = computed(() => this.resolver.resolveWithMeta(this.entry()))
  protected readonly badges = computed(() => buildNestedBadges(this.resolved().isVariant))
  protected readonly entryText = computed(() => {
    const text: unknown = this.resolved().resolvedEntry.fields.text
    return typeof text === 'string' ? text : ''
  })
  protected readonly nestedEntries = computed(() => {
    const nested: unknown = this.resolved().resolvedEntry.fields.nested
    return Array.isArray(nested) ? nested.filter(isEntry) : []
  })
}

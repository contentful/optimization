import { Component, computed, forwardRef, inject, input } from '@angular/core'
import { NgContentfulEntry } from '@contentful/optimization-angular'
import type { ContentfulEntry } from '../../types/contentful'
import { isRecord } from '../../utils'
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
  providers: [NgContentfulEntry],
})
export class NestedContent {
  // inputs
  readonly entry = input.required<ContentfulEntry>()
  // TODO: nested entries currently always use auto observation — add observation input if manual tracking is needed

  // protected state
  protected readonly resolved = inject(NgContentfulEntry).with({ entry: this.entry }).resolved
  protected readonly badges = computed(() => buildNestedBadges(this.resolved()?.isVariant ?? false))
  protected readonly entryText = computed(() => {
    const text: unknown = this.resolved()?.resolvedEntry.fields.text
    return typeof text === 'string' ? text : ''
  })
  protected readonly nestedEntries = computed(() => {
    const nested: unknown = this.resolved()?.resolvedEntry.fields.nested
    return Array.isArray(nested) ? nested.filter(isEntry) : []
  })
}

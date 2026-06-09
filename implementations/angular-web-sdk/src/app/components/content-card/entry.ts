import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, inject, input } from '@angular/core'
import { NgContentfulEntry, type ObservationMode } from '@contentful/optimization-angular'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { EntryClickScenario } from '../../config/entries'
import type { ContentfulEntry, RichTextDocument } from '../../types/contentful'
import { buildEntryBadges, EntryBadge } from './badge'
import { RichText } from './rich-text'

function isRichTextField(field: unknown): field is RichTextDocument {
  return (
    typeof field === 'object' &&
    field !== null &&
    'nodeType' in field &&
    (field as { nodeType: unknown }).nodeType === 'document' &&
    'content' in field &&
    Array.isArray((field as { content: unknown }).content)
  )
}

@Component({
  selector: 'app-content-entry',
  imports: [NgTemplateOutlet, RichText, EntryBadge],
  templateUrl: './entry.html',
  providers: [NgContentfulEntry],
})
export class ContentEntry {
  // inputs
  readonly entry = input.required<ContentfulEntry>()
  readonly observation = input.required<ObservationMode>()
  readonly clickScenario = input<EntryClickScenario | undefined>(undefined)
  readonly selectedOptimizations = input<SelectedOptimizationArray | undefined>(undefined)
  readonly liveUpdates = input<boolean | undefined>(undefined)

  // injected dependencies
  private readonly liveEntry = inject(NgContentfulEntry).with({
    entry: this.entry,
    selectedOptimizations: this.selectedOptimizations,
    liveUpdates: this.liveUpdates,
    observation: this.observation,
  })

  // protected state
  protected readonly resolved = this.liveEntry.resolved
  protected readonly richTextField = computed(() =>
    Object.values(this.liveEntry.resolved()?.resolvedEntry.fields ?? {}).find(isRichTextField),
  )
  protected readonly entryText = computed(() => {
    const text: unknown = this.liveEntry.resolved()?.resolvedEntry.fields.text
    return typeof text === 'string' ? text : 'No content'
  })
  protected readonly badges = computed(() => {
    const r = this.resolved()
    if (!r) return []
    return buildEntryBadges(
      r.isVariant,
      this.observation(),
      this.richTextField(),
      this.clickScenario(),
    )
  })
}

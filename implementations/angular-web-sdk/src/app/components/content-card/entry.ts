import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, effect, inject, input } from '@angular/core'
import { NgContentfulLiveEntry } from '@contentful/optimization-angular'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { EntryClickScenario } from '../../config/entries'
import type { ContentfulEntry, RichTextDocument } from '../../types/contentful'
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
  imports: [NgTemplateOutlet, RichText],
  templateUrl: './entry.html',
  providers: [NgContentfulLiveEntry],
})
export class ContentEntry {
  // inputs
  readonly entry = input.required<ContentfulEntry>()
  readonly observation = input.required<'auto' | 'manual'>()
  readonly clickScenario = input<EntryClickScenario | undefined>(undefined)
  readonly selectedOptimizations = input<SelectedOptimizationArray | undefined>(undefined)
  readonly liveUpdates = input<boolean | undefined>(undefined)

  // injected dependencies
  private readonly liveEntry = inject(NgContentfulLiveEntry)

  constructor() {
    effect(() => {
      this.liveEntry.configure({
        entry: this.entry(),
        selectedOptimizations: this.selectedOptimizations(),
        liveUpdates: this.liveUpdates(),
        observation: this.observation(),
      })
    })
  }

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
    const tags: Array<{ label: string; mod: string }> = []
    tags.push({ label: r.isVariant ? 'variant' : 'baseline', mod: r.isVariant ? 'variant' : '' })
    const rt = this.richTextField()
    if (rt) tags.push({ label: 'rich text', mod: 'richtext' })
    if (rt && JSON.stringify(rt).includes('"nt_mergetag"'))
      tags.push({ label: 'merge tag', mod: 'mergetag' })
    tags.push({ label: this.observation(), mod: this.observation() })
    const scenario = this.clickScenario()
    if (scenario) tags.push({ label: scenario, mod: 'click' })
    return tags
  })
}

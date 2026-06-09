import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, effect, inject, input } from '@angular/core'
import { NgContentfulLiveEntry } from '@contentful/optimization-angular'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import type { EntryClickScenario } from '../../config/entries'
import type { ContentfulEntry, RichTextDocument } from '../../types/contentful'
import { EntryBadge } from './badge'
import { RichText } from './rich-text'

interface Badge {
  label: string
  mod: string
  title: string
}

const OBSERVATION_TITLES: Record<string, string> = {
  auto: 'Entry tracking is handled automatically via data attributes',
  manual: 'Entry tracking is triggered manually by the app',
}

const CLICK_SCENARIO_TITLES: Record<string, string> = {
  direct: 'Click tracking fires directly on this entry element',
  ancestor: 'Click tracking fires on an ancestor wrapper element',
  descendant: 'Click tracking fires from a descendant button inside this entry',
}

function buildBadges(
  isVariant: boolean,
  obs: 'auto' | 'manual',
  rt: RichTextDocument | undefined,
  scenario: EntryClickScenario | undefined,
): Badge[] {
  const tags: Badge[] = [
    {
      label: isVariant ? 'variant' : 'baseline',
      mod: isVariant ? 'variant' : '',
      title: isVariant
        ? 'This entry is a variant selected by the optimization SDK'
        : 'This entry is the baseline (no optimization applied)',
    },
    { label: obs, mod: obs, title: OBSERVATION_TITLES[obs] ?? obs },
  ]
  if (rt)
    tags.push({ label: 'rich text', mod: 'richtext', title: 'Entry contains a rich text field' })
  if (rt && JSON.stringify(rt).includes('"nt_mergetag"'))
    tags.push({
      label: 'merge tag',
      mod: 'mergetag',
      title: 'Rich text contains merge tag entries that are resolved at render time',
    })
  if (scenario)
    tags.push({ label: scenario, mod: 'click', title: CLICK_SCENARIO_TITLES[scenario] ?? scenario })
  return tags
}

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
    return buildBadges(r.isVariant, this.observation(), this.richTextField(), this.clickScenario())
  })
}

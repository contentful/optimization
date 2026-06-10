import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, inject, input } from '@angular/core'
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser'
import { NgContentfulEntry, type ObservationMode } from '@contentful/optimization-angular'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { BLOCKS, INLINES } from '@contentful/rich-text-types'
import type { EntryClickScenario } from '../../fixtures'
import { NgContentfulLiveUpdates } from '../../services/live-updates'
import type { ContentfulEntry, RichTextDocument } from '../../types/contentful'
import { isRecord } from '../../utils'
import { buildEntryBadges, EntryBadge } from './badge'

function isRichTextField(field: unknown): field is RichTextDocument {
  return (
    isRecord(field) &&
    field.nodeType === 'document' &&
    Array.isArray(isRecord(field) && field.content)
  )
}

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type NodeRenderer = (children: () => string, data: Record<string, unknown>) => string

const RENDERERS: Partial<Record<string, NodeRenderer>> = {
  [BLOCKS.PARAGRAPH]: (children) => `<p>${children()}</p>`,
  [BLOCKS.HEADING_1]: (children) => `<h1>${children()}</h1>`,
  [BLOCKS.HEADING_2]: (children) => `<h2>${children()}</h2>`,
  [BLOCKS.HEADING_3]: (children) => `<h3>${children()}</h3>`,
  [BLOCKS.HEADING_4]: (children) => `<h4>${children()}</h4>`,
  [BLOCKS.HEADING_5]: (children) => `<h5>${children()}</h5>`,
  [BLOCKS.HEADING_6]: (children) => `<h6>${children()}</h6>`,
  [BLOCKS.UL_LIST]: (children) => `<ul>${children()}</ul>`,
  [BLOCKS.OL_LIST]: (children) => `<ol>${children()}</ol>`,
  [BLOCKS.LIST_ITEM]: (children) => `<li>${children()}</li>`,
  [BLOCKS.QUOTE]: (children) => `<blockquote>${children()}</blockquote>`,
  [BLOCKS.HR]: () => `<hr />`,
  [BLOCKS.EMBEDDED_ENTRY]: () => '',
  [BLOCKS.EMBEDDED_ASSET]: () => '',
  [INLINES.HYPERLINK]: (children, data) => {
    const uri = typeof data.uri === 'string' ? escape(data.uri) : '#'
    return `<a href="${uri}">${children()}</a>`
  },
}

function renderNode(node: unknown): string {
  if (!isRecord(node)) return ''
  const nodeType = typeof node.nodeType === 'string' ? node.nodeType : ''
  const value = typeof node.value === 'string' ? node.value : ''
  const content = Array.isArray(node.content) ? node.content : []
  const data = isRecord(node.data) ? node.data : {}
  const children = (): string => content.map((c) => renderNode(c)).join('')

  if (nodeType === 'text') return escape(value)
  const { [nodeType]: renderer } = RENDERERS
  return renderer !== undefined ? renderer(children, data) : children()
}

@Component({
  selector: 'app-content-entry',
  imports: [NgTemplateOutlet, EntryBadge],
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
  private readonly sanitizer = inject(DomSanitizer)
  private readonly liveUpdatesService = inject(NgContentfulLiveUpdates)
  private readonly isLive = computed(() => {
    if (this.liveUpdatesService.previewPanelVisible()) return true
    const override = this.liveUpdates()
    if (override !== undefined) return override
    return this.liveUpdatesService.globalLiveUpdates()
  })

  private readonly liveEntry = inject(NgContentfulEntry).with({
    entry: this.entry,
    selectedOptimizations: this.selectedOptimizations,
    liveUpdates: this.isLive,
    observation: this.observation,
  })

  protected readonly resolved = this.liveEntry.resolved
  protected readonly richTextHtml = computed<SafeHtml | undefined>(() => {
    const doc = Object.values(this.resolved()?.resolvedEntry.fields ?? {}).find(isRichTextField)
    if (!doc) return undefined
    return this.sanitizer.bypassSecurityTrustHtml(renderNode(doc))
  })
  protected readonly entryText = computed(() => {
    const text: unknown = this.resolved()?.resolvedEntry.fields.text
    return typeof text === 'string' ? text : 'No content'
  })
  protected readonly badges = computed(() => {
    const r = this.resolved()
    if (!r) return []
    return buildEntryBadges({
      isVariant: r.meta.isVariant,
      obs: this.observation(),
      hasRichText: r.meta.hasRichText,
      hasMergeTag: r.meta.hasMergeTag,
      mergeTagResolved: r.meta.mergeTagResolved,
      scenario: this.clickScenario(),
    })
  })
}

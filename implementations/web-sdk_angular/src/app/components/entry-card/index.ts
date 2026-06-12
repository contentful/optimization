import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, forwardRef, inject, input } from '@angular/core'
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser'
import { BLOCKS, INLINES, type Document } from '@contentful/rich-text-types'
import {
  BADGE_MAP,
  type BadgeKey,
  type EntryClickScenario,
  type LiveMode,
  type MergeTagMode,
} from '../../fixtures'
import type { ContentfulEntry } from '../../services/contentful-client'
import { injectContentfulEntry, type ObservationMode } from '../../services/entry'
import { NgLiveUpdates } from '../../services/live-updates'
import { isRecord } from '../../utils'

// — Badge —

function liveModeKey(override: boolean | undefined, isLive: boolean): LiveMode {
  if (override === true) return 'live-always-on'
  if (override === false) return 'live-always-off'
  return isLive ? 'live-on' : 'live-off'
}

function mergeTagKey(resolved: boolean | undefined): MergeTagMode | undefined {
  if (resolved === true) return 'mergetag'
  if (resolved === false) return 'mergetag-fallback'
  return undefined
}

@Component({
  selector: 'app-entry-card-badge',
  template: `<span
    [class]="mod() ? 'entry-card__badge entry-card__badge--' + mod() : 'entry-card__badge'"
    [attr.data-tooltip]="title()"
    >{{ label() }}</span
  >`,
  styleUrl: './index.scss',
})
export class Badge {
  readonly label = input.required<string>()
  readonly mod = input<string>('')
  readonly title = input<string>('')
}

// — Rich text renderer —

function isRichTextField(field: unknown): field is Document {
  return isRecord(field) && field.nodeType === 'document' && Array.isArray(field.content)
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

// — Entry card —

function isContentfulEntry(value: unknown): value is ContentfulEntry {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    typeof value.sys.id === 'string' &&
    isRecord(value.fields)
  )
}

@Component({
  selector: 'app-entry-card',
  imports: [NgTemplateOutlet, Badge, forwardRef(() => EntryCard)],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class EntryCard {
  readonly entry = input.required<ContentfulEntry>()
  readonly observation = input<ObservationMode>('auto')
  readonly clickScenario = input<EntryClickScenario | undefined>(undefined)
  readonly liveUpdates = input<boolean | undefined>(undefined)

  private readonly sanitizer = inject(DomSanitizer)
  private readonly liveUpdatesService = inject(NgLiveUpdates)

  private readonly isLive = computed(() => {
    if (this.liveUpdatesService.previewPanelVisible()) return true
    return this.liveUpdates() ?? this.liveUpdatesService.globalLiveUpdates()
  })

  private readonly manualTracking = computed(() => this.observation() === 'manual')

  protected readonly resolved = injectContentfulEntry({
    entry: this.entry,
    isLive: this.isLive,
    manualTracking: this.manualTracking,
  })

  protected readonly isVariant = computed(() => this.resolved().optimizationId !== undefined)
  protected readonly richTextHtml = computed<SafeHtml | undefined>(() => {
    const { entry } = this.resolved()
    const doc = Object.values(entry.fields).find(isRichTextField)
    if (!doc) return undefined
    return this.sanitizer.bypassSecurityTrustHtml(renderNode(doc))
  })
  protected readonly entryText = computed(() => {
    const text: unknown = this.resolved().entry.fields.text
    return typeof text === 'string' ? text : 'No content'
  })
  protected readonly nestedEntries = computed(() => {
    const nested: unknown = this.resolved().entry.fields.nested
    return Array.isArray(nested) ? nested.filter(isContentfulEntry) : []
  })
  protected readonly isAuto = computed(() => this.observation() === 'auto')
  protected readonly badges = computed(() => {
    const r = this.resolved()
    const mergeTag = mergeTagKey(r.mergeTagResolved)
    const scenario = this.clickScenario()
    const keys: BadgeKey[] = [
      ...(mergeTag ? [mergeTag] : []),
      ...(scenario ? [scenario] : []),
      this.isVariant() ? 'variant' : 'baseline',
      this.observation(),
      liveModeKey(this.liveUpdates(), this.isLive()),
    ]
    return keys.map((k) => BADGE_MAP[k])
  })
}

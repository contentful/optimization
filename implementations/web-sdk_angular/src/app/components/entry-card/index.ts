import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, forwardRef, inject, input } from '@angular/core'
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser'
import {
  isMergeTagEntry,
  isRecord,
  isResolvedContentfulEntry,
  isRichTextDocument,
  isUnresolvedEntryLink,
  type MergeTagEntry,
} from '@contentful/optimization-web/api-schemas'
import { BLOCKS, INLINES } from '@contentful/rich-text-types'
import {
  BADGE_MAP,
  type BadgeKey,
  type EntryClickScenario,
  type LiveMode,
  type MergeTagMode,
} from '../../fixtures'
import type { ContentEntrySkeleton, ContentfulEntry } from '../../services/contentful-client'
import { injectContentfulEntry } from '../../services/entry'
import { NgLiveUpdates } from '../../services/live-updates'
import { NgContentfulOptimization } from '../../services/optimization'

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
    [class]="'entry-card__badge entry-card__badge--' + key()"
    [attr.data-tooltip]="title()"
    >{{ label() }}</span
  >`,
})
export class Badge {
  readonly label = input.required<string>()
  readonly key = input.required<string>()
  readonly title = input<string>('')
}

// — Rich text renderer —

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type NodeRenderer = (children: () => string, data: Record<string, unknown>) => string
type MergeTagValueResolver = (target: MergeTagEntry) => string | undefined

/**
 * Substitution outcome tracked alongside a single rich-text walk. Callers pass
 * a fresh cell in; the walker flips `resolved` to true or false depending on
 * whether the first encountered merge tag returned a value. Kept out of the
 * entry-resolution layer so it lives next to the badge that consumes it —
 * mirrors the Next.js reference which resolves at render time via
 * `OptimizedEntryRenderContext.getMergeTagValue`.
 */
interface MergeTagRenderState {
  resolved: boolean | undefined
}

// `INLINES.EMBEDDED_ENTRY` is a string enum member; widen it once at module
// scope so the render walk compares plain strings and `@typescript-eslint/no-
// unsafe-enum-comparison` stays quiet without a cast at the call site.
const EMBEDDED_ENTRY_NODE_TYPE: string = INLINES.EMBEDDED_ENTRY

const BLOCK_RENDERERS: Partial<Record<string, NodeRenderer>> = {
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

function renderMergeTag(
  data: Record<string, unknown>,
  getMergeTagValue: MergeTagValueResolver | undefined,
  state: MergeTagRenderState,
): string {
  if (!('target' in data)) return ''
  const { target } = data
  if (isUnresolvedEntryLink(target) || !isMergeTagEntry(target)) return ''
  const value = getMergeTagValue?.(target)
  if (value !== undefined) {
    state.resolved = true
    return escape(value)
  }
  state.resolved ??= false
  return typeof target.fields.nt_fallback === 'string' ? escape(target.fields.nt_fallback) : ''
}

function renderNode(
  node: unknown,
  getMergeTagValue: MergeTagValueResolver | undefined,
  state: MergeTagRenderState,
): string {
  if (!isRecord(node)) return ''
  const nodeType = typeof node.nodeType === 'string' ? node.nodeType : ''
  const value = typeof node.value === 'string' ? node.value : ''
  const content = Array.isArray(node.content) ? node.content : []
  const data = isRecord(node.data) ? node.data : {}
  const children = (): string => content.map((c) => renderNode(c, getMergeTagValue, state)).join('')

  if (nodeType === 'text') return escape(value)
  if (nodeType === EMBEDDED_ENTRY_NODE_TYPE) return renderMergeTag(data, getMergeTagValue, state)
  const { [nodeType]: renderer } = BLOCK_RENDERERS
  return renderer !== undefined ? renderer(children, data) : children()
}

// — Entry card —

@Component({
  selector: 'app-entry-card',
  imports: [NgTemplateOutlet, Badge, forwardRef(() => EntryCard)],
  templateUrl: './index.html',
})
export class EntryCard {
  readonly entry = input.required<ContentfulEntry>()
  readonly manualTracking = input(false)
  readonly clickScenario = input<EntryClickScenario | undefined>(undefined)
  readonly liveUpdates = input<boolean | undefined>(undefined)
  readonly testId = input<string | undefined>(undefined)

  private readonly sanitizer = inject(DomSanitizer)
  private readonly liveUpdatesService = inject(NgLiveUpdates)
  private readonly optimization = inject(NgContentfulOptimization)

  private readonly isLive = computed(() => {
    if (this.liveUpdatesService.previewPanelVisible()) return true
    return this.liveUpdates() ?? this.liveUpdatesService.globalLiveUpdates()
  })

  protected readonly resolved = injectContentfulEntry({
    entry: this.entry,
    isLive: this.isLive,
    manualTracking: this.manualTracking,
  })

  // Rich text and merge-tag detection share a single walk so the badge signal
  // reflects the substitution outcome for exactly this render.
  private readonly renderedRichText = computed<
    { html: SafeHtml; mergeTagResolved: boolean | undefined } | undefined
  >(() => {
    const { entry } = this.resolved()
    const doc = Object.values(entry.fields).find(isRichTextDocument)
    if (!doc) return undefined
    const profile = this.optimization.profile()
    const runtime = this.optimization.runtime()
    const getMergeTagValue = profile
      ? (target: MergeTagEntry): string | undefined => runtime.getMergeTagValue(target, profile)
      : undefined
    const state: MergeTagRenderState = { resolved: undefined }
    const html = this.sanitizer.bypassSecurityTrustHtml(renderNode(doc, getMergeTagValue, state))
    return { html, mergeTagResolved: state.resolved }
  })

  protected readonly effectiveTestId = computed(() => this.testId() ?? this.resolved().baselineId)
  protected readonly isVariant = computed(() => this.resolved().optimizationId !== undefined)
  protected readonly richTextHtml = computed<SafeHtml | undefined>(
    () => this.renderedRichText()?.html,
  )
  protected readonly entryText = computed(() => {
    const text: unknown = this.resolved().entry.fields.text
    return typeof text === 'string' ? text : 'No content'
  })
  protected readonly nestedEntries = computed(() => {
    const nested: unknown = this.resolved().entry.fields.nested
    return Array.isArray(nested)
      ? nested.filter(isResolvedContentfulEntry<ContentEntrySkeleton>)
      : []
  })
  protected readonly badges = computed(() => {
    const mergeTag = mergeTagKey(this.renderedRichText()?.mergeTagResolved)
    const scenario = this.clickScenario()
    const keys: BadgeKey[] = [
      ...(mergeTag ? [mergeTag] : []),
      ...(scenario ? [scenario] : []),
      this.isVariant() ? 'variant' : 'baseline',
      this.manualTracking() ? 'manual' : 'auto',
      liveModeKey(this.liveUpdates(), this.isLive()),
    ]
    return keys.map((k) => ({ key: k, ...BADGE_MAP[k] }))
  })
}

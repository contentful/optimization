import { Component, computed, inject, input } from '@angular/core'
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser'
import { NgContentfulEntry } from '@contentful/optimization-angular'
import { BLOCKS, INLINES } from '@contentful/rich-text-types'
import type { RichTextDocument } from '../../types/contentful'
import { isRecord } from '../../utils'

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type GetMergeTag = (target: unknown) => string
type NodeRenderer = (
  children: () => string,
  data: Record<string, unknown>,
  getMergeTag: GetMergeTag,
) => string

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
  [INLINES.EMBEDDED_ENTRY]: (_children, data, getMergeTag) => escape(getMergeTag(data.target)),
}

function renderNode(node: unknown, getMergeTag: GetMergeTag): string {
  if (!isRecord(node)) return ''
  const nodeType = typeof node.nodeType === 'string' ? node.nodeType : ''
  const value = typeof node.value === 'string' ? node.value : ''
  const content = Array.isArray(node.content) ? node.content : []
  const data = isRecord(node.data) ? node.data : {}
  const children = (): string => content.map((c) => renderNode(c, getMergeTag)).join('')

  if (nodeType === 'text') return escape(value)
  const { [nodeType]: renderer } = RENDERERS
  return renderer !== undefined ? renderer(children, data, getMergeTag) : children()
}

@Component({
  selector: 'app-rich-text',
  template: `<div class="rich-text" [innerHTML]="html()"></div>`,
})
export class RichText {
  readonly richText = input.required<RichTextDocument>()

  private readonly entry = inject(NgContentfulEntry)
  private readonly sanitizer = inject(DomSanitizer)

  protected readonly html = computed<SafeHtml>(() => {
    const raw = renderNode(this.richText(), (target) => this.entry.resolveMergeTag(target))
    return this.sanitizer.bypassSecurityTrustHtml(raw)
  })
}

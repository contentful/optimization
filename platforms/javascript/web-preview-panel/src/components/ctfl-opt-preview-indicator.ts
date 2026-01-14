import { html, LitElement, type TemplateResult } from 'lit'
import { property } from 'lit/decorators.js'

export const CTFL_OPT_PREVIEW_INDICATOR_TAG = 'ctfl-opt-preview-indicator'

export function isCtflOptPreviewIndicator(element?: Element): element is CtflOptPreviewIndicator {
  return element?.tagName === CTFL_OPT_PREVIEW_INDICATOR_TAG.toUpperCase()
}

export class CtflOptPreviewIndicator extends LitElement {
  @property({ type: String })
  accessor title = ''

  protected render(): TemplateResult {
    return html`<svg title=${this.title} width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="9" fill="#BBF7D0"></circle>
      <circle cx="9" cy="9" r="4" fill="#22C55E"></circle>
    </svg>`
  }
}

export function defineCtflOptPreviewIndicator(): void {
  if (!customElements.get(CTFL_OPT_PREVIEW_INDICATOR_TAG)) {
    customElements.define(CTFL_OPT_PREVIEW_INDICATOR_TAG, CtflOptPreviewIndicator)
  }
}

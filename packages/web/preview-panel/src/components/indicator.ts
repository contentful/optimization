import { html, LitElement, type TemplateResult } from 'lit'
import { property } from 'lit/decorators.js'

/**
 * Custom element tag name for {@link Indicator}.
 *
 * @public
 */
export const INDICATOR_TAG = 'ctfl-opt-preview-indicator'

/**
 * A small green dot indicator used to visually denote that the visitor
 * naturally qualifies for an audience or variant.
 *
 * @see {@link LitElement}
 *
 * @public
 */
export class Indicator extends LitElement {
  /** Accessible title rendered on the SVG indicator. */
  @property({ type: String })
  accessor title = ''

  /** @internal */
  protected render(): TemplateResult {
    return html`<svg title=${this.title} width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="9" fill="#BBF7D0"></circle>
      <circle cx="9" cy="9" r="4" fill="#22C55E"></circle>
    </svg>`
  }
}

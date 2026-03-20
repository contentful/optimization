import { html, LitElement, type TemplateResult } from 'lit'
import { property } from 'lit/decorators.js'

/**
 * Custom element tag name for {@link Indicator}.
 *
 * @public
 */
export const INDICATOR_TAG = 'ctfl-opt-preview-indicator'

/**
 * Type guard that checks whether an element is a {@link Indicator}.
 *
 * @param element - The element to check.
 * @returns `true` if the element's tag matches {@link INDICATOR_TAG}.
 *
 * @example
 * ```ts
 * if (isIndicator(el)) {
 *   el.title = 'Active'
 * }
 * ```
 *
 * @public
 */
export function isIndicator(element?: Element): element is Indicator {
  return element?.tagName === INDICATOR_TAG.toUpperCase()
}

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

/**
 * Registers the {@link Indicator} custom element if not already defined.
 *
 * @example
 * ```ts
 * defineIndicator()
 * ```
 *
 * @public
 */
export function defineIndicator(): void {
  if (!customElements.get(INDICATOR_TAG)) {
    customElements.define(INDICATOR_TAG, Indicator)
  }
}

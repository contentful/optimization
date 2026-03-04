import { html, LitElement, type TemplateResult } from 'lit'
import { property } from 'lit/decorators.js'

/**
 * Custom element tag name for {@link CtflOptPreviewIndicator}.
 *
 * @public
 */
export const CTFL_OPT_PREVIEW_INDICATOR_TAG = 'ctfl-opt-preview-indicator'

/**
 * Type guard that checks whether an element is a {@link CtflOptPreviewIndicator}.
 *
 * @param element - The element to check.
 * @returns `true` if the element's tag matches {@link CTFL_OPT_PREVIEW_INDICATOR_TAG}.
 *
 * @example
 * ```ts
 * if (isCtflOptPreviewIndicator(el)) {
 *   el.title = 'Active'
 * }
 * ```
 *
 * @public
 */
export function isCtflOptPreviewIndicator(element?: Element): element is CtflOptPreviewIndicator {
  return element?.tagName === CTFL_OPT_PREVIEW_INDICATOR_TAG.toUpperCase()
}

/**
 * A small green dot indicator used to visually denote that the visitor
 * naturally qualifies for an audience or variant.
 *
 * @see {@link LitElement}
 *
 * @public
 */
export class CtflOptPreviewIndicator extends LitElement {
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
 * Registers the {@link CtflOptPreviewIndicator} custom element if not already defined.
 *
 * @example
 * ```ts
 * defineCtflOptPreviewIndicator()
 * ```
 *
 * @public
 */
export function defineCtflOptPreviewIndicator(): void {
  if (!customElements.get(CTFL_OPT_PREVIEW_INDICATOR_TAG)) {
    customElements.define(CTFL_OPT_PREVIEW_INDICATOR_TAG, CtflOptPreviewIndicator)
  }
}

import UFuzzy from '@leeoniya/ufuzzy'
import { consume } from '@lit/context'
import { css, html, LitElement, type TemplateResult } from 'lit'
import { property } from 'lit/decorators.js'
import { searchContext } from '../lib/contexts'

const fuzzySearch = new UFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1,
})

/**
 * Custom element tag name for {@link MatchedText}.
 *
 * @public
 */
export const MATCHED_TEXT_TAG = 'ctfl-opt-preview-matched-text' as const

/**
 * Type guard that checks whether an element is a {@link MatchedText}.
 *
 * @param element - The element to check.
 * @returns `true` if the element's tag matches {@link MATCHED_TEXT_TAG}.
 *
 * @example
 * ```ts
 * if (isMatchedText(el)) {
 *   el.text = 'Europe Visitors'
 * }
 * ```
 *
 * @public
 */
export function isMatchedText(element?: Element): element is MatchedText {
  return element?.tagName === MATCHED_TEXT_TAG.toUpperCase()
}

/**
 * Renders text with search-matching substrings visually emphasized.
 *
 * Consumes {@link searchContext} from the parent panel and wraps each
 * case-insensitive substring match in a styled `<span>`.
 *
 * @see {@link LitElement}
 *
 * @public
 */
export class MatchedText extends LitElement {
  /** Source text to render. */
  @property({ type: String })
  accessor text = ''

  /** Normalized search query consumed from the parent panel context. */
  @consume({ context: searchContext, subscribe: true })
  @property({ attribute: false })
  accessor search: string | undefined = undefined

  /** @internal */
  private _segments(): Array<{ text: string; match: boolean }> {
    const { text } = this
    const search = this.search ?? ''

    if (!text || !search) return [{ text, match: false }]

    const idxs = fuzzySearch.filter([text], search)
    if (!idxs?.length) return [{ text, match: false }]

    const info = fuzzySearch.info(idxs, [text], search)
    const {
      ranges: [ranges],
    } = info
    if (!ranges?.length) return [{ text, match: false }]

    return UFuzzy.highlight(
      text,
      ranges,
      (part, match) => ({ text: part, match }),
      [] as Array<{ text: string; match: boolean }>,
      (segments, segment) => {
        if (segment.text) segments.push(segment)
        return segments
      },
    )
  }

  /** @internal */
  protected render(): TemplateResult {
    return html`${this._segments().map(({ text, match }) =>
      match ? html`<span class="match">${text}</span>` : text,
    )}`
  }

  static styles = css`
    :host {
      display: inline;
    }

    .match {
      font-weight: 900;
    }
  `
}

/**
 * Registers the {@link MatchedText} custom element if not already defined.
 *
 * @example
 * ```ts
 * defineMatchedText()
 * ```
 *
 * @public
 */
export function defineMatchedText(): void {
  if (!customElements.get(MATCHED_TEXT_TAG)) {
    customElements.define(MATCHED_TEXT_TAG, MatchedText)
  }
}

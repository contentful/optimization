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
 * Renders text with fuzzy search matches visually emphasized.
 *
 * Consumes {@link searchContext} from the parent panel and wraps fuzzy-match
 * ranges in styled `<span>` elements.
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

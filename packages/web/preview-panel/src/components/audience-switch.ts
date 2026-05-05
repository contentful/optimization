import { css, html, LitElement, type TemplateResult } from 'lit'
import { property, state } from 'lit/decorators.js'
import { ifDefined } from 'lit/directives/if-defined.js'

/**
 * Custom element tag name for {@link AudienceSwitch}.
 *
 * @public
 */
export const AUDIENCE_SWITCH_TAG = 'ctfl-opt-preview-audience-switch' as const

/**
 * Type guard that checks whether an element is a {@link AudienceSwitch}.
 *
 * @param element - The element to check.
 * @returns `true` if the element's tag matches {@link AUDIENCE_SWITCH_TAG}.
 *
 * @example
 * ```ts
 * if (isAudienceSwitch(el)) {
 *   el.value = true
 * }
 * ```
 *
 * @public
 */
export function isAudienceSwitch(element?: Element): element is AudienceSwitch {
  return element?.tagName === AUDIENCE_SWITCH_TAG.toUpperCase()
}

/**
 * Three-state audience toggle rendered as a radio group.
 *
 * Updates {@link AudienceSwitch.value} to `false`, `undefined`,
 * or `true` and re-emits a host-level `change` event when the selection changes.
 *
 * @see {@link LitElement}
 *
 * @public
 */
export class AudienceSwitch extends LitElement {
  /** @internal */
  private readonly _fieldName = `audience-state-${Math.random().toString(36).slice(2)}`

  /** ID of the external label element used to name the radio group. */
  @property({ attribute: 'aria-labelledby' })
  accessor labelledBy: string | undefined = undefined

  /** Selected audience override state. */
  @property({ attribute: false })
  accessor value: boolean | undefined = undefined

  /** @internal */
  @state()
  private accessor _indicatorStyle = 'opacity: 0;'

  /** @internal */
  private readonly _onChange = (event: Event): void => {
    if (!(event.currentTarget instanceof HTMLInputElement)) return
    event.stopPropagation()
    this.value =
      event.currentTarget.value === 'undefined' ? undefined : event.currentTarget.value === 'true'
    this.dispatchEvent(new Event('change'))
  }

  /** @internal */
  private readonly _syncIndicator = (): void => {
    const group = this.renderRoot.querySelector('[role="radiogroup"]')
    const selected = this.renderRoot.querySelector('label input:checked + span')

    if (!(group instanceof HTMLElement) || !(selected instanceof HTMLElement)) {
      this._indicatorStyle = 'opacity: 0;'
      return
    }

    const groupRect = group.getBoundingClientRect()
    const selectedRect = selected.getBoundingClientRect()

    this._indicatorStyle = [
      `width: ${selectedRect.width}px`,
      `height: ${selectedRect.height}px`,
      `transform: translate(${selectedRect.left - groupRect.left}px, ${selectedRect.top - groupRect.top}px)`,
      'opacity: 1',
    ].join('; ')
  }

  /** @internal */
  protected updated(): void {
    this._syncIndicator()
  }

  /** @internal */
  protected render(): TemplateResult {
    const labelledBy = this.labelledBy?.trim()

    return html`
      <div
        role="radiogroup"
        aria-labelledby=${ifDefined(labelledBy === '' ? undefined : labelledBy)}
        aria-label=${ifDefined(labelledBy ? undefined : 'Toggle audience')}
      >
        <span class="indicator" style=${this._indicatorStyle} aria-hidden="true"></span>

        <label>
          <input
            type="radio"
            name=${this._fieldName}
            value="false"
            .checked=${this.value === false}
            @change=${this._onChange}
          />
          <span>Off</span>
        </label>

        <label>
          <input
            type="radio"
            name=${this._fieldName}
            value="undefined"
            .checked=${this.value !== true && this.value !== false}
            @change=${this._onChange}
          />
          <span>Default</span>
        </label>

        <label>
          <input
            type="radio"
            name=${this._fieldName}
            value="true"
            .checked=${this.value === true}
            @change=${this._onChange}
          />
          <span>On</span>
        </label>
      </div>
    `
  }

  static styles = css`
    div {
      position: relative;
      display: inline-flex;
      gap: 0.25rem;
      padding: 2px;
      border-radius: 0.375rem;
      background: #f3f4f6;
      font-size: 0.75rem;
    }

    .indicator {
      position: absolute;
      top: 0;
      left: 0;
      border-radius: 0.375rem;
      background: #fff;
      box-shadow: 0 1px 2px #00000014;
      pointer-events: none;
      transition:
        width 160ms ease,
        height 160ms ease,
        transform 160ms ease,
        opacity 160ms ease;
    }

    label {
      position: relative;
      z-index: 1;
      cursor: pointer;
    }

    label input {
      position: absolute;
      inset: 0;
      margin: 0;
      opacity: 0;
    }

    label span {
      position: relative;
      display: block;
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      color: #9ca3af;
      transition: color 160ms ease;
      cursor: pointer;
    }

    label span:hover,
    label input:checked + span {
      color: #374151;
    }

    label input:focus-visible + span {
      outline: 2px solid #7025bb;
      outline-offset: 2px;
    }
  `
}

/**
 * Registers the {@link AudienceSwitch} custom element if not already defined.
 *
 * @example
 * ```ts
 * defineAudienceSwitch()
 * ```
 *
 * @public
 */
export function defineAudienceSwitch(): void {
  if (!customElements.get(AUDIENCE_SWITCH_TAG)) {
    customElements.define(AUDIENCE_SWITCH_TAG, AudienceSwitch)
  }
}

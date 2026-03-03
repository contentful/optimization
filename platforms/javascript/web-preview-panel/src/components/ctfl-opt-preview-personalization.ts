import type { PersonalizationEntry } from '@contentful/optimization-web/api-schemas'
import { css, html, LitElement, nothing, type TemplateResult } from 'lit'
import { property } from 'lit/decorators.js'

/**
 * Payload emitted by {@link CtflOptPreviewPersonalization} when a variant radio
 * selection changes.
 *
 * @public
 */
export interface RecordRadioGroupChangeDetail {
  /** Experience ID identifying the personalization that changed. */
  key: string
  /** Zero-based index of the newly selected variant. */
  value: number
}

/**
 * Custom event carrying a {@link RecordRadioGroupChangeDetail} payload.
 *
 * @public
 */
export type RecordRadioGroupChangeEvent = CustomEvent<RecordRadioGroupChangeDetail>

/**
 * Type guard that checks whether an event is a {@link RecordRadioGroupChangeEvent}.
 *
 * @param event - The DOM event to check.
 * @returns `true` if the event is a `CustomEvent` with `key` and `value` in its detail.
 *
 * @example
 * ```ts
 * element.addEventListener('change', (event) => {
 *   if (isRecordRadioGroupChangeEvent(event)) {
 *     console.log(event.detail.key, event.detail.value)
 *   }
 * })
 * ```
 *
 * @public
 */
export function isRecordRadioGroupChangeEvent(event: Event): event is RecordRadioGroupChangeEvent {
  if (!(event instanceof CustomEvent)) return false
  return 'key' in event.detail && 'value' in event.detail
}

/**
 * Custom element tag name for {@link CtflOptPreviewPersonalization}.
 *
 * @public
 */
export const CTFL_OPT_PREVIEW_PERSONALIZATION_TAG = 'ctfl-opt-preview-personalization' as const

/**
 * Type guard that checks whether an element is a {@link CtflOptPreviewPersonalization}.
 *
 * @param element - The element to check.
 * @returns `true` if the element's tag matches {@link CTFL_OPT_PREVIEW_PERSONALIZATION_TAG}.
 *
 * @example
 * ```ts
 * if (isCtflOptPreviewPersonalization(el)) {
 *   el.personalization = entry
 * }
 * ```
 *
 * @public
 */
export function isCtflOptPreviewPersonalization(
  element?: Element,
): element is CtflOptPreviewPersonalization {
  return element?.tagName === CTFL_OPT_PREVIEW_PERSONALIZATION_TAG.toUpperCase()
}

/** @internal */
const percentageFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
})

/**
 * Renders a single personalization as a radio-group fieldset, allowing the
 * user to select which variant to preview.
 *
 * Emits a `change` {@link RecordRadioGroupChangeEvent} when a variant is selected.
 *
 * @see {@link LitElement}
 *
 * @public
 */
export class CtflOptPreviewPersonalization extends LitElement {
  /** The personalization entry whose variants are rendered. */
  @property({ attribute: false })
  accessor personalization: PersonalizationEntry | undefined = undefined

  /** Index of the variant the visitor naturally qualifies for, if any. */
  @property({ attribute: false })
  accessor naturalValue: number | undefined = undefined

  /** Index of the currently selected variant. */
  @property({ attribute: false })
  accessor value = 0

  /** @internal */
  private get _experienceId(): string | undefined {
    return this.personalization?.fields.nt_experience_id
  }

  /** @internal */
  private _onChange(e: Event): void {
    if (this._experienceId === undefined) return

    const value =
      e.currentTarget instanceof HTMLInputElement ? Number(e.currentTarget.value) : undefined

    if (value === undefined || Number.isNaN(value)) return

    this.dispatchEvent(
      new CustomEvent<RecordRadioGroupChangeDetail>('change', {
        detail: { key: this._experienceId, value },
        bubbles: false,
        composed: true,
      }),
    )
  }

  /**
   * Renders the variant radio buttons, or the text `"None"` when no distribution exists.
   *
   * @returns Template for the variant list.
   *
   * @example
   * ```ts
   * html`${this.variantsTemplate()}`
   * ```
   *
   * @public
   */
  variantsTemplate(): TemplateResult | string {
    if (!this.personalization?.fields.nt_config?.distribution?.length) return 'None'

    return html`
      <div>
        ${this.personalization.fields.nt_config.distribution.map((dist, index) =>
          this.variantTemplate(dist, index),
        )}
      </div>
    `
  }

  /**
   * Renders a single variant as a labelled radio input.
   *
   * @param dist - Distribution weight of this variant (0–1).
   * @param index - Zero-based index of the variant.
   * @returns Template for one variant radio button, or `undefined` when the personalization is unset.
   *
   * @example
   * ```ts
   * html`${this.variantTemplate(0.5, 1)}`
   * ```
   *
   * @public
   */
  variantTemplate(dist: number, index: number): TemplateResult | undefined {
    if (!this.personalization) return

    const radioId = `radiogroup-${this.personalization.sys.id}`

    return html`
      <label>
        <span class="variant-heading">
          <span class="variant-name">${index === 0 ? 'Baseline' : `Variant ${index}`}</span>
          ${this.naturalValue === index
            ? html`<ctfl-opt-preview-indicator
                title="You naturally qualify for this variant."
              ></ctfl-opt-preview-indicator>`
            : nothing}
        </span>
        <span class="variant-dist">${percentageFormatter.format(dist)}</span>
        <input
          type="radio"
          name="${radioId}"
          value="${index}"
          .checked=${this.value === index}
          @change=${(e: Event) => {
            this._onChange(e)
          }}
        />
      </label>
    `
  }

  /** @internal */
  protected render(): TemplateResult {
    return html`
      <fieldset>
        <legend>
          <span title="${this.personalization?.fields.nt_experience_id}"
            >${this.personalization?.fields.nt_name}</span
          >

          <span class="personalization-type">
            ${this.personalization?.fields.nt_type === 'nt_experiment'
              ? 'Experiment'
              : 'Personalization'}
          </span>
        </legend>

        ${this.variantsTemplate()}
      </fieldset>
    `
  }

  static styles = css`
    * {
      box-sizing: border-box;
    }

    fieldset {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
      border: 1px solid rgb(229, 231, 235);
      border-radius: 0.5rem;
      background: #fff;
    }

    legend,
    p {
      margin: 0;
    }

    legend {
      display: flex;
      flex-direction: column-reverse;
      gap: 0.25rem;
      float: left;
      width: 100%;
      font: inherit;
    }

    div {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-auto-rows: auto;
      gap: 0.5rem;
    }

    label {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: 1fr 1fr;
      row-gap: 0.25rem;
      column-gap: 0.5rem;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid rgb(229, 231, 235);
      border-radius: 0.375rem;
      color: rgb(55, 65, 81);
      cursor: pointer;
    }

    label::after {
      content: '';
      grid-column: 2;
      grid-row: 1 / span 2;
      align-self: center;
      justify-self: end;
      width: calc(1rem - 2px);
      height: calc(1rem - 2px);
      border: 1px solid rgb(209, 213, 219);
      border-radius: 50%;
    }

    label:focus,
    label:focus-visible,
    label:focus-within {
      outline: 2px solid rgb(112, 37, 187);
      outline-offset: 2px;
    }

    label > span {
      grid-column: 1;
    }

    label > input {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      white-space: nowrap;
      border: 0;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
    }

    label:has(input:checked) {
      border-color: rgb(112, 37, 187);
    }

    label:has(input:checked)::after {
      width: calc(1rem - 10px);
      height: calc(1rem - 10px);
      border: 5px solid rgb(112, 37, 187);
    }

    label:has(input:checked):has(input:disabled) {
      border-color: rgb(156, 163, 175);
    }

    label:has(input:checked):has(input:disabled)::after {
      border-color: rgb(209, 213, 219);
    }

    label:has(input:disabled) {
      color: rgb(107, 114, 128);
    }

    .personalization-type {
      font-size: 0.875rem;
      line-height: 1.25rem;
      color: rgb(107, 114, 128);
    }

    .variant-heading {
      display: flex;
      gap: 0.5rem;
    }

    .variant-name {
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1.25rem;
    }

    .variant-dist {
      font-size: 0.75rem;
      color: rgb(156, 163, 175);
    }
  `
}

/**
 * Registers the {@link CtflOptPreviewPersonalization} custom element if not already defined.
 *
 * @example
 * ```ts
 * defineCtflOptPreviewPersonalization()
 * ```
 *
 * @public
 */
export function defineCtflOptPreviewPersonalization(): void {
  if (!customElements.get(CTFL_OPT_PREVIEW_PERSONALIZATION_TAG)) {
    customElements.define(CTFL_OPT_PREVIEW_PERSONALIZATION_TAG, CtflOptPreviewPersonalization)
  }
}

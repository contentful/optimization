import type { PersonalizationEntry, SelectedPersonalization } from '@contentful/optimization-web'
import { consume } from '@lit/context'
import { css, html, LitElement, nothing, type TemplateResult } from 'lit'
import { property } from 'lit/decorators.js'
import {
  type HostSignalFns,
  hostSignalFnsContext,
  type HostSignals,
  hostSignalsContext,
} from '../contexts'

export interface RecordRadioGroupChangeDetail {
  key: string
  value: number
}
export type RecordRadioGroupChangeEvent = CustomEvent<RecordRadioGroupChangeDetail>

export const CTFL_OPT_PREVIEW_PERSONALIZATION_TAG = 'ctfl-opt-preview-personalization'

export function isCtflOptPreviewPersonalization(
  element?: Element,
): element is CtflOptPreviewPersonalization {
  return element?.tagName === CTFL_OPT_PREVIEW_PERSONALIZATION_TAG.toUpperCase()
}

const percentageFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
})

export class CtflOptPreviewPersonalization extends LitElement {
  @property({ attribute: false })
  accessor personalization: PersonalizationEntry | undefined = undefined

  @property({ attribute: false })
  accessor defaultSelectedPersonalization: SelectedPersonalization | undefined = undefined

  @consume({ context: hostSignalFnsContext })
  @property({ attribute: false })
  accessor hostSignalFns: HostSignalFns | undefined = undefined

  @consume({ context: hostSignalsContext })
  @property({ attribute: false })
  accessor hostSignals: HostSignals | undefined = undefined

  private get _selectedPersonalization(): SelectedPersonalization | undefined {
    return this.hostSignals?.selectedPersonalizations.value?.find(
      (selected) => selected.experienceId === this.personalization?.sys.id,
    )
  }

  private get _value(): number {
    return this._selectedPersonalization?.variantIndex ?? 0
  }

  private set _value(variantIndex: number) {
    if (!this.personalization?.sys.id || !this.hostSignals?.selectedPersonalizations.value) return

    const {
      hostSignals: {
        selectedPersonalizations: { value: selectedPersonalizations },
      },
    } = this

    const change = { experienceId: this.personalization.sys.id, variantIndex }

    const selectedIndex = selectedPersonalizations.findIndex(
      (selected) => selected.experienceId === change.experienceId,
    )

    if (selectedIndex >= 0) {
      const selected = selectedPersonalizations.at(selectedIndex)

      if (!selected) return

      selectedPersonalizations[selectedIndex] = { ...selected, ...change }
    } else {
      selectedPersonalizations.push({ ...change, variants: {} })
    }

    this.hostSignals.selectedPersonalizations.value = [...selectedPersonalizations]
  }

  private _onChange(e: Event): void {
    const value =
      e.currentTarget instanceof HTMLInputElement ? Number(e.currentTarget.value) : undefined

    if (value !== undefined) this._value = value
  }

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

  variantTemplate(dist: number, index: number): TemplateResult | undefined {
    if (!this.personalization) return

    const radioId = `radiogroup-${this.personalization.sys.id}`

    return html`
      <label>
        <span class="variant-heading">
          <span class="variant-name">${index === 0 ? 'Baseline' : `Variant ${index}`}</span>
          ${index === (this.defaultSelectedPersonalization?.variantIndex ?? 0)
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
          .checked=${this._value === index}
          @change=${(e: Event) => {
            this._onChange(e)
          }}
        />
      </label>
    `
  }

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

export function defineCtflOptPreviewPersonalization(): void {
  if (!customElements.get(CTFL_OPT_PREVIEW_PERSONALIZATION_TAG)) {
    customElements.define(CTFL_OPT_PREVIEW_PERSONALIZATION_TAG, CtflOptPreviewPersonalization)
  }
}

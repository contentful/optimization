import type {
  AudienceEntry,
  PersonalizationEntry,
  SelectedPersonalizationArray,
} from '@contentful/optimization-web'
import { consume } from '@lit/context'
import { css, html, LitElement, nothing, type TemplateResult } from 'lit'
import { property } from 'lit/decorators.js'
import {
  type HostSignalFns,
  hostSignalFnsContext,
  type HostSignals,
  hostSignalsContext,
} from '../contexts'

export interface AudienceContentToggleDetail {
  key: string
  open: boolean
}
export type AudienceContentToggleEvent = CustomEvent<AudienceContentToggleDetail>

export const CTFL_OPT_PREVIEW_AUDIENCE_CONTENT_TOGGLE = 'ctfl_opt_preview_audience_content_toggle'
export const CTFL_OPT_PREVIEW_AUDIENCE_TAG = 'ctfl-opt-preview-audience'

export function isCtflOptPreviewAudience(element?: Element): element is CtflOptPreviewAudience {
  return element?.tagName === CTFL_OPT_PREVIEW_AUDIENCE_TAG.toUpperCase()
}

export class CtflOptPreviewAudience extends LitElement {
  @property({ type: Boolean, reflect: true })
  accessor open = true

  @property({ attribute: false })
  accessor audience: AudienceEntry | undefined = undefined

  @property({ attribute: false })
  accessor personalizations: PersonalizationEntry[] = []

  @property({ attribute: false })
  accessor defaultSelectedPersonalizations: SelectedPersonalizationArray = []

  @consume({ context: hostSignalFnsContext })
  @property({ attribute: false })
  accessor hostSignalFns: HostSignalFns | undefined = undefined

  @consume({ context: hostSignalsContext })
  @property({ attribute: false })
  accessor hostSignals: HostSignals | undefined = undefined

  private get _audienceId(): string | undefined {
    return this.audience?.sys.id
  }

  private _toggleContent(): void {
    this.open = !this.open

    if (!this._audienceId) return

    this.dispatchEvent(
      new CustomEvent<AudienceContentToggleDetail>(CTFL_OPT_PREVIEW_AUDIENCE_CONTENT_TOGGLE, {
        detail: { key: this._audienceId, open: this.open },
        bubbles: true,
        composed: true,
      }),
    )
  }

  protected render(): TemplateResult {
    return html`
      <div class="details">
        <button
          class="summary"
          @click=${() => {
            this._toggleContent()
          }}
        >
          <span>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              ></path>
            </svg>
          </span>

          <span class="audience-name">${this.audience?.fields.nt_name}</span>

          ${this.audience &&
          this.hostSignals?.profile.value?.audiences.includes(this.audience.sys.id)
            ? html`<ctfl-opt-preview-indicator
                title="You naturally qualify for this audience."
              ></ctfl-opt-preview-indicator>`
            : nothing}
        </button>

        <div class="content" ?hidden=${!this.open}>
          ${this.personalizations.length
            ? this.personalizations.map(
                (personalization) => html`
                  <ctfl-opt-preview-personalization
                    .personalization=${personalization}
                    .defaultSelectedPersonalization=${this.defaultSelectedPersonalizations.find(
                      (defaultSelected) => defaultSelected.experienceId === personalization.sys.id,
                    )}
                  ></ctfl-opt-preview-personalization>
                `,
              )
            : html`<p>No personalizations exist for this audience</p>`}
        </div>
      </div>
    `
  }

  static styles = css`
    * {
      box-sizing: border-box;
    }

    .summary {
      all: unset;
      display: flex;
      gap: 0.75rem;
      box-sizing: border-box;
      padding: 0.5rem 0;
      cursor: pointer;
      font: inherit;
      -webkit-appearance: none;
      appearance: none;
    }

    .summary:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    .summary svg {
      width: 1.25rem;
      height: 1.25rem;
    }

    .audience-name {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
    }

    .details:not(:has(.content[hidden])) .summary svg {
      transform: rotate(90deg);
    }

    .details {
      padding: 0.5rem 0.75rem 0.75rem;
      background: rgb(249, 250, 251);
      border-radius: 0.5rem;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding-top: 0.25rem;
    }

    .content[hidden] {
      display: none;
    }
  `
}

export function defineCtflOptPreviewAudience(): void {
  if (!customElements.get(CTFL_OPT_PREVIEW_AUDIENCE_TAG)) {
    customElements.define(CTFL_OPT_PREVIEW_AUDIENCE_TAG, CtflOptPreviewAudience)
  }
}

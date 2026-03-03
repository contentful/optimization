import type {
  AudienceEntry,
  PersonalizationEntry,
  Profile,
  SelectedPersonalizationArray,
} from '@contentful/optimization-web/api-schemas'
import { consume } from '@lit/context'
import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit'
import { property, state } from 'lit/decorators.js'
import { overridesContext, profileContext } from '../lib/contexts'
import type {
  RecordRadioGroupChangeDetail,
  RecordRadioGroupChangeEvent,
} from './ctfl-opt-preview-personalization'

/**
 * Custom element tag name for {@link CtflOptPreviewAudience}.
 *
 * @public
 */
export const CTFL_OPT_PREVIEW_AUDIENCE_TAG = 'ctfl-opt-preview-audience' as const

/**
 * Event name dispatched when an audience section is toggled open or closed.
 *
 * @public
 */
export const CTFL_OPT_PREVIEW_AUDIENCE_CONTENT_TOGGLE =
  'ctfl_opt_preview_audience_content_toggle' as const

/**
 * Payload emitted when an audience section is expanded or collapsed.
 *
 * @public
 */
export interface AudienceContentToggleDetail {
  /** Audience entry ID that was toggled. */
  key: string
  /** Whether the section is now open. */
  open: boolean
}

/**
 * Custom event carrying an {@link AudienceContentToggleDetail} payload.
 *
 * @public
 */
export type AudienceContentToggleEvent = CustomEvent<AudienceContentToggleDetail>

/**
 * Event name dispatched when a personalization variant selection changes
 * within an audience group.
 *
 * @public
 */
export const CTFL_OPT_PREVIEW_PERSONALIZATION_CHANGE =
  'ctfl-opt-preview-personalization-change' as const

/**
 * Type guard that checks whether an element is a {@link CtflOptPreviewAudience}.
 *
 * @param element - The element to check.
 * @returns `true` if the element's tag matches {@link CTFL_OPT_PREVIEW_AUDIENCE_TAG}.
 *
 * @example
 * ```ts
 * if (isCtflOptPreviewAudience(el)) {
 *   el.audience = audienceEntry
 * }
 * ```
 *
 * @public
 */
export function isCtflOptPreviewAudience(element?: Element): element is CtflOptPreviewAudience {
  return element?.tagName === CTFL_OPT_PREVIEW_AUDIENCE_TAG.toUpperCase()
}

/**
 * Collapsible audience section that groups {@link CtflOptPreviewPersonalization}
 * components under a single audience heading.
 *
 * Consumes the {@link profileContext} and {@link overridesContext} from the
 * parent panel to determine natural qualification and active overrides.
 *
 * @see {@link LitElement}
 *
 * @public
 */
export class CtflOptPreviewAudience extends LitElement {
  /** Whether the audience section is expanded. */
  @property({ type: Boolean, reflect: true })
  accessor open = true

  /** The audience entry this section represents. */
  @property({ attribute: false })
  accessor audience: AudienceEntry | undefined = undefined

  /** Personalizations that target this audience. */
  @property({ attribute: false })
  accessor personalizations: PersonalizationEntry[] = []

  /** Default selected personalizations before any overrides are applied. */
  @property({ attribute: false })
  accessor defaultSelectedPersonalizations: SelectedPersonalizationArray = []

  /** Visitor profile consumed from the parent panel context. */
  @consume({ context: profileContext, subscribe: true })
  @property({ attribute: false })
  accessor profile: Profile | undefined = undefined

  /** Active variant overrides consumed from the parent panel context. */
  @consume({ context: overridesContext, subscribe: true })
  @property({ attribute: false })
  accessor overrides: Map<string, number> | undefined = undefined

  /** @internal */
  @state()
  accessor natural = false

  /** @internal */
  @state()
  accessor valuesByKey: Record<string, number> = {}

  /** @internal */
  private defaultsByKey: Record<string, number> = {}

  /** @internal */
  private get _audienceId(): string | undefined {
    return this.audience?.sys.id
  }

  /** @internal */
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

  /** @internal */
  private _onPersonalizationChange(event: RecordRadioGroupChangeEvent): void {
    const {
      detail: { key, value },
    } = event
    this.valuesByKey = { ...this.valuesByKey, [key]: event.detail.value }

    this.dispatchEvent(
      new CustomEvent<RecordRadioGroupChangeDetail>(CTFL_OPT_PREVIEW_PERSONALIZATION_CHANGE, {
        detail: { key, value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /** @internal */
  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('profile'))
      this.natural = Boolean(this._audienceId && this.profile?.audiences.includes(this._audienceId))

    if (changed.has('personalizations') || changed.has('defaultSelectedPersonalizations')) {
      const nextDefaults: Record<string, number> = Object.fromEntries(
        this.personalizations
          .map((personalization): [string, number] => {
            const defaultSelectedPersonalization = this.defaultSelectedPersonalizations.find(
              (selected) => selected.experienceId === personalization.fields.nt_experience_id,
            )
            if (!defaultSelectedPersonalization) return ['', 0]
            return [
              defaultSelectedPersonalization.experienceId,
              defaultSelectedPersonalization.variantIndex,
            ]
          })
          .filter(([key]) => key.length > 0),
      )

      const nextValues: Record<string, number> = {}
      for (const {
        fields: { nt_experience_id: experienceId },
      } of this.personalizations) {
        nextValues[experienceId] =
          this.overrides?.get(experienceId) ?? nextDefaults[experienceId] ?? 0
      }

      this.defaultsByKey = nextDefaults
      this.valuesByKey = nextValues
    }
  }

  /** @internal */
  // TODO: Support audience-wide personalization switch
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

          ${this.natural
            ? html`<ctfl-opt-preview-indicator
                title="You naturally qualify for this audience."
              ></ctfl-opt-preview-indicator>`
            : nothing}
        </button>

        <div class="content" ?hidden=${!this.open}>
          ${this.personalizations.length
            ? this.personalizations.map((personalization) => {
                const {
                  fields: { nt_experience_id: experienceId },
                } = personalization

                const value =
                  this.valuesByKey[experienceId] ?? this.defaultsByKey[experienceId] ?? 0

                return html`
                  <ctfl-opt-preview-personalization
                    .naturalValue=${this.natural ? this.defaultsByKey[experienceId] : undefined}
                    .personalization=${personalization}
                    .value=${value}
                    @change=${(event: RecordRadioGroupChangeEvent) => {
                      this._onPersonalizationChange(event)
                    }}
                  ></ctfl-opt-preview-personalization>
                `
              })
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
      padding: 0.5rem 0.75rem 0 0;
      border-radius: 0.5rem;
      cursor: pointer;
      font: inherit;
      -webkit-appearance: none;
      appearance: none;
    }

    .summary:focus-visible {
      outline: 2px solid rgb(112, 37, 187);
      outline-offset: -2px;
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

/**
 * Registers the {@link CtflOptPreviewAudience} custom element if not already defined.
 *
 * @example
 * ```ts
 * defineCtflOptPreviewAudience()
 * ```
 *
 * @public
 */
export function defineCtflOptPreviewAudience(): void {
  if (!customElements.get(CTFL_OPT_PREVIEW_AUDIENCE_TAG)) {
    customElements.define(CTFL_OPT_PREVIEW_AUDIENCE_TAG, CtflOptPreviewAudience)
  }
}

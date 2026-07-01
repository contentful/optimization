import type { AudienceWithExperiences } from '@contentful/optimization-core/preview-support'
import { css, html, LitElement, nothing, type TemplateResult } from 'lit'
import { property } from 'lit/decorators.js'
import { isAudienceSwitch } from './audience-switch'
import type { RecordRadioGroupChangeDetail, RecordRadioGroupChangeEvent } from './optimization'

function isRecordRadioGroupChangeDetailValue(
  value: unknown,
): value is RecordRadioGroupChangeDetail {
  if (value === null || typeof value !== 'object') return false

  const { key, value: variantIndex } = value as { key?: unknown; value?: unknown }
  return typeof key === 'string' && typeof variantIndex === 'number'
}

/**
 * Custom element tag name for {@link Audience}.
 *
 * @public
 */
export const AUDIENCE_TAG = 'ctfl-opt-preview-audience' as const

/**
 * Event name dispatched when an audience section is toggled open or closed.
 *
 * @public
 */
export const AUDIENCE_CONTENT_TOGGLE = 'ctfl_opt_preview_audience_content_toggle' as const

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
 * Event name dispatched when an optimization variant selection changes
 * within an audience group.
 *
 * @public
 */
export const OPTIMIZATION_CHANGE = 'ctfl-opt-preview-optimization-change' as const

/**
 * Event name dispatched when an audience-wide switch changes.
 *
 * @public
 */
export const AUDIENCE_SWITCH_CHANGE = 'ctfl-opt-preview-audience-switch-change' as const

/**
 * Payload emitted when the audience-wide switch updates all optimizations.
 *
 * @public
 */
export interface AudienceSwitchChangeDetail {
  /** Audience entry ID targeted by the switch, when the group is audience-backed. */
  audienceId?: string
  /** Experience IDs affected by the audience-wide switch. */
  experienceIds: string[]
  /** Variant changes produced by the switch state. */
  variantChanges: RecordRadioGroupChangeDetail[]
}

/**
 * Custom event carrying an {@link AudienceSwitchChangeDetail} payload.
 *
 * @public
 */
export type AudienceSwitchChangeEvent = CustomEvent<AudienceSwitchChangeDetail>

/**
 * Type guard that checks whether an event is an {@link AudienceSwitchChangeEvent}.
 *
 * @param event - The DOM event to check.
 * @returns `true` if the event is a `CustomEvent` with audience switch target data.
 *
 * @public
 */
export function isAudienceSwitchChangeEvent(event: Event): event is AudienceSwitchChangeEvent {
  if (!(event instanceof CustomEvent)) return false

  const { detail } = event as CustomEvent<unknown>
  if (detail === null || typeof detail !== 'object') return false

  const { audienceId, experienceIds, variantChanges } = detail as {
    audienceId?: unknown
    experienceIds?: unknown
    variantChanges?: unknown
  }

  return (
    (audienceId === undefined || typeof audienceId === 'string') &&
    Array.isArray(experienceIds) &&
    experienceIds.every((value) => typeof value === 'string') &&
    Array.isArray(variantChanges) &&
    variantChanges.every(isRecordRadioGroupChangeDetailValue)
  )
}

/**
 * Collapsible audience section that groups {@link Optimization}
 * components under a single audience heading.
 *
 * Uses the Core preview model to render qualification, active override, and
 * variant selection state.
 *
 * @see {@link LitElement}
 *
 * @public
 */
export class Audience extends LitElement {
  /** Whether the audience section is expanded. */
  @property({ type: Boolean, reflect: true })
  accessor open = true

  /** Audience group model this section represents. */
  @property({ attribute: false })
  accessor audienceGroup: AudienceWithExperiences | undefined = undefined

  /** @internal */
  private get _audienceId(): string | undefined {
    return this.audienceGroup?.audience.id
  }

  /** @internal */
  private get _audienceSwitchValue(): boolean | undefined {
    switch (this.audienceGroup?.overrideState) {
      case 'on':
        return true
      case 'off':
        return false
      default:
        break
    }

    const experiences = this.audienceGroup?.experiences ?? []
    if (!experiences.some(({ isOverridden }) => isOverridden)) return undefined

    const values = experiences.map(({ currentVariantIndex }) => currentVariantIndex)
    if (values.every((value) => value === 1)) return true
    if (values.every((value) => value === 0)) return false

    return undefined
  }

  /** @internal */
  private _toggleContent(): void {
    this.open = !this.open

    if (!this._audienceId) return

    this.dispatchEvent(
      new CustomEvent<AudienceContentToggleDetail>(AUDIENCE_CONTENT_TOGGLE, {
        detail: { key: this._audienceId, open: this.open },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /** @internal */
  private _onOptimizationChange(event: RecordRadioGroupChangeEvent): void {
    const {
      detail: { key, value },
    } = event

    this.dispatchEvent(
      new CustomEvent<RecordRadioGroupChangeDetail>(OPTIMIZATION_CHANGE, {
        detail: { key, value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /** @internal */
  private readonly _onAudienceSwitchChange = (event: Event): void => {
    const { currentTarget } = event
    if (!(currentTarget instanceof Element) || !isAudienceSwitch(currentTarget)) return

    const detail =
      currentTarget.value === undefined
        ? []
        : (this.audienceGroup?.experiences.map(
            ({ id: key }): RecordRadioGroupChangeDetail => ({
              key,
              value: currentTarget.value ? 1 : 0,
            }),
          ) ?? [])
    const { _audienceId: audienceId } = this
    const eventDetail: AudienceSwitchChangeDetail = {
      ...(audienceId === undefined ? {} : { audienceId }),
      experienceIds: this.audienceGroup?.experiences.map(({ id }) => id) ?? [],
      variantChanges: detail,
    }

    this.dispatchEvent(
      new CustomEvent<AudienceSwitchChangeDetail>(AUDIENCE_SWITCH_CHANGE, {
        detail: eventDetail,
        bubbles: true,
        composed: true,
      }),
    )
  }

  protected render(): TemplateResult {
    const labelId = `audience-label-${Math.random().toString(36).slice(2)}`
    const { audienceGroup } = this

    return html`
      <div class="details">
        <div class="summary">
          <button
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

            <span class="audience-name" id=${labelId}>
              <ctfl-opt-preview-matched-text
                .text=${audienceGroup?.audience.name ?? ''}
              ></ctfl-opt-preview-matched-text>
            </span>

            ${audienceGroup?.isQualified
              ? html`<ctfl-opt-preview-indicator
                  title="You naturally qualify for this audience."
                ></ctfl-opt-preview-indicator>`
              : nothing}
          </button>

          <ctfl-opt-preview-audience-switch
            labelledBy=${labelId}
            .value=${this._audienceSwitchValue}
            @change=${this._onAudienceSwitchChange}
          ></ctfl-opt-preview-audience-switch>
        </div>

        <div class="content" ?hidden=${!this.open}>
          ${audienceGroup?.experiences.length
            ? audienceGroup.experiences.map(
                (optimization) => html`
                  <ctfl-opt-preview-optimization
                    .naturalValue=${optimization.naturalVariantIndex}
                    .optimization=${optimization}
                    .value=${optimization.currentVariantIndex}
                    @change=${(event: RecordRadioGroupChangeEvent) => {
                      this._onOptimizationChange(event)
                    }}
                  ></ctfl-opt-preview-optimization>
                `,
              )
            : html`
                <div class="no-content">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    ></path>
                  </svg>

                  <div class="no-content-text">
                    <p>No Optimizations</p>
                    <p>Get started by creating a new Optimization.</p>
                  </div>
                </div>
              `}
        </div>
      </div>
    `
  }

  static styles = css`
    * {
      box-sizing: border-box;
    }

    .summary {
      display: flex;
      justify-content: space-between;
      padding-bottom: 0.75rem;
    }

    .summary button {
      all: unset;
      display: flex;
      gap: 0.75rem;
      box-sizing: border-box;
      margin-top: 0.25rem;
      border-radius: 0.5rem;
      cursor: pointer;
      font: inherit;
      -webkit-appearance: none;
      appearance: none;
    }

    .summary button:focus-visible {
      outline: 2px solid #7025bb;
      outline-offset: -2px;
    }

    .summary button svg {
      width: 1.25rem;
      height: 1.25rem;
    }

    .audience-name {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      overflow: hidden;
      font-weight: 500;
    }

    .details:not(:has(.content[hidden])) .summary button svg {
      transform: rotate(90deg);
    }

    .details {
      padding: 0.5rem 0.75rem 0.75rem;
      background: #f9fafb;
      border-radius: 0.5rem;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .content[hidden] {
      display: none;
    }

    .no-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 2.5rem 0;
    }

    .no-content svg {
      color: #9ca3af;
      width: 4rem;
    }

    .no-content-text {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      text-align: center;
    }

    .no-content-text p {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.25rem;
      color: #6b7280;
    }

    .no-content-text p:first-child {
      font-weight: 500;
      color: #111827;
    }
  `
}

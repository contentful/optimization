import type {
  AudienceEntry,
  OptimizationEntry,
  SelectedOptimizationArray,
} from '@contentful/optimization-web/api-schemas'
import UFuzzy from '@leeoniya/ufuzzy'
import { consume } from '@lit/context'
import { groupBy } from 'es-toolkit'
import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit'
import { property, state } from 'lit/decorators.js'
import { ALL_VISITORS_FALLBACK_AUDIENCE, ALL_VISITORS_FALLBACK_AUDIENCE_ID } from '../constants'
import { searchContext } from '../lib/contexts'
import type { AudienceContentToggleEvent } from './audience'

const fuzzySearch = new UFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1,
})

interface AudienceState {
  audienceContentOpenByKey: Record<string, boolean>
  audienceOptimizations: Map<AudienceEntry, OptimizationEntry[]>
  audienceDefaultSelectedOptimizations: Map<AudienceEntry, SelectedOptimizationArray>
}

/**
 * Custom element tag name for {@link Audiences}.
 *
 * @public
 */
export const AUDIENCES_TAG = 'ctfl-opt-preview-audiences' as const

/**
 * Type guard that checks whether an element is an {@link Audiences}.
 *
 * @param element - The element to check.
 * @returns `true` if the element's tag matches {@link AUDIENCES_TAG}.
 *
 * @example
 * ```ts
 * if (isAudiences(el)) {
 *   el.audiences = audienceEntries
 * }
 * ```
 *
 * @public
 */
export function isAudiences(element?: Element): element is Audiences {
  return element?.tagName === AUDIENCES_TAG.toUpperCase()
}

/** @internal */
function compareCount(a?: unknown[], b?: unknown[]): boolean {
  return (a?.length ?? 0) < (b?.length ?? 0)
}

/** @internal */
function compareString(a?: string, b?: string): boolean {
  return (a ?? 'a') < (b ?? 'a')
}

/** @internal */
function matchesSearchQuery(value: string | undefined, searchQuery: string): boolean {
  if (!value) return false
  return (fuzzySearch.filter([value], searchQuery)?.length ?? 0) > 0
}

/** @internal */
function buildAudienceState({
  audiences,
  optimizationEntries,
  defaultSelectedOptimizations,
}: {
  audiences: AudienceEntry[]
  optimizationEntries: OptimizationEntry[]
  defaultSelectedOptimizations: SelectedOptimizationArray
}): AudienceState {
  const audienceIdMap = audiences.reduce((audienceMap: Record<string, AudienceEntry>, audience) => {
    audienceMap[audience.sys.id] = audience
    return audienceMap
  }, {})

  const audienceIdOptimizationMap = groupBy(
    [...optimizationEntries].sort((a, b) =>
      compareString(a.fields.nt_name, b.fields.nt_name) ? -1 : 1,
    ),
    (optimization) => optimization.fields.nt_audience?.sys.id ?? ALL_VISITORS_FALLBACK_AUDIENCE_ID,
  )

  if (audienceIdOptimizationMap[ALL_VISITORS_FALLBACK_AUDIENCE_ID]) {
    audienceIdMap[ALL_VISITORS_FALLBACK_AUDIENCE_ID] = ALL_VISITORS_FALLBACK_AUDIENCE
  }

  const audienceIds = Object.keys(audienceIdMap)
    .sort((a, b) =>
      compareString(audienceIdMap[a]?.fields.nt_name, audienceIdMap[b]?.fields.nt_name) ? 1 : -1,
    )
    .sort((a, b) =>
      compareCount(audienceIdOptimizationMap[a], audienceIdOptimizationMap[b]) ? 1 : -1,
    )

  const audienceContentOpenByKey = audienceIds.reduce((acc: Record<string, boolean>, id) => {
    acc[id] = true
    return acc
  }, {})

  const audienceOptimizations = audienceIds.reduce((acc, audienceId) => {
    const audience = audienceIdMap[audienceId] ?? ALL_VISITORS_FALLBACK_AUDIENCE
    acc.set(audience, audienceIdOptimizationMap[audienceId] ?? [])
    return acc
  }, new Map<AudienceEntry, OptimizationEntry[]>())

  const audienceDefaultSelectedOptimizations = Array.from(audienceOptimizations.keys()).reduce(
    (acc, audience) => {
      const optimizations = audienceOptimizations.get(audience)
      acc.set(
        audience,
        defaultSelectedOptimizations.filter((defaultSelected) =>
          optimizations
            ?.map((optimization) => optimization.fields.nt_experience_id)
            .includes(defaultSelected.experienceId),
        ),
      )
      return acc
    },
    new Map<AudienceEntry, SelectedOptimizationArray>(),
  )

  return {
    audienceContentOpenByKey,
    audienceOptimizations,
    audienceDefaultSelectedOptimizations,
  }
}

/**
 * Audience list container that owns audience grouping, filtering, and
 * expand/collapse state for the preview panel.
 *
 * Consumes the normalized {@link searchContext} value from the parent panel
 * and renders matching audience sections.
 *
 * @see {@link LitElement}
 *
 * @public
 */
export class Audiences extends LitElement {
  /** All audience entries fetched from Contentful. */
  @property({ attribute: false })
  accessor audiences: AudienceEntry[] = []

  /** All optimization entries fetched from Contentful. */
  @property({ attribute: false })
  accessor optimizationEntries: OptimizationEntry[] = []

  /** Default optimization selections before any user overrides. */
  @property({ attribute: false })
  accessor defaultSelectedOptimizations: SelectedOptimizationArray = []

  /** Normalized search query consumed from the parent panel context. */
  @consume({ context: searchContext, subscribe: true })
  @property({ attribute: false })
  accessor search: string | undefined = undefined

  /** @internal */
  @state()
  private accessor _audienceContentOpenByKey: Record<string, boolean> = {}

  /** @internal */
  @state()
  private accessor _audienceOptimizations = new Map<AudienceEntry, OptimizationEntry[]>()

  /** @internal */
  @state()
  private accessor _audienceDefaultSelectedOptimizations = new Map<
    AudienceEntry,
    SelectedOptimizationArray
  >()

  /** @internal */
  private get _anyAudienceContentClosed(): boolean {
    const {
      _visibleAudienceIds: audienceIds,
      _audienceContentOpenByKey: audienceContentOpenByKey,
    } = this
    if (!audienceIds.length) return false
    return audienceIds.some((id) => audienceContentOpenByKey[id] === false)
  }

  /** @internal */
  private get _filteredAudienceEntries(): Array<[AudienceEntry, OptimizationEntry[]]> {
    const { _audienceOptimizations: audienceOptimizations } = this
    const searchQuery = this.search ?? ''
    const audienceEntries = Array.from(audienceOptimizations.entries())

    if (!searchQuery) return audienceEntries

    return audienceEntries.filter(
      ([audience, optimizations]) =>
        matchesSearchQuery(audience.fields.nt_name, searchQuery) ||
        optimizations.some((optimization) =>
          matchesSearchQuery(optimization.fields.nt_name, searchQuery),
        ),
    )
  }

  /** @internal */
  private get _visibleAudienceIds(): string[] {
    return this._filteredAudienceEntries.map(([audience]) => audience.sys.id)
  }

  /** @internal */
  private readonly _onAudienceContentToggle = (event: AudienceContentToggleEvent): void => {
    const {
      detail: { key, open },
    } = event
    this._audienceContentOpenByKey = { ...this._audienceContentOpenByKey, [key]: open }
  }

  /** @internal */
  private _toggleAllAudienceContent(): void {
    const {
      _visibleAudienceIds: visibleAudienceIds,
      _audienceContentOpenByKey: audienceContentOpenByKey,
      _anyAudienceContentClosed: open,
    } = this
    if (!visibleAudienceIds.length) return

    this._audienceContentOpenByKey = Object.keys(audienceContentOpenByKey).reduce(
      (acc: Record<string, boolean>, id) => {
        acc[id] = visibleAudienceIds.includes(id) ? open : (audienceContentOpenByKey[id] ?? true)
        return acc
      },
      {},
    )
  }

  /** @internal */
  protected willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('audiences') ||
      changed.has('optimizationEntries') ||
      changed.has('defaultSelectedOptimizations')
    ) {
      const audienceState = buildAudienceState({
        audiences: this.audiences,
        optimizationEntries: this.optimizationEntries,
        defaultSelectedOptimizations: this.defaultSelectedOptimizations,
      })
      const {
        audienceContentOpenByKey,
        audienceOptimizations,
        audienceDefaultSelectedOptimizations,
      } = audienceState

      this._audienceContentOpenByKey = audienceContentOpenByKey
      this._audienceOptimizations = audienceOptimizations
      this._audienceDefaultSelectedOptimizations = audienceDefaultSelectedOptimizations
    }
  }

  /** @internal */
  protected render(): TemplateResult {
    const {
      _filteredAudienceEntries: filteredAudienceEntries,
      _audienceContentOpenByKey: audienceContentOpenByKey,
      _audienceDefaultSelectedOptimizations: audienceDefaultSelectedOptimizations,
    } = this

    return html`
      ${filteredAudienceEntries.length > 1
        ? html`
            <p>
              <button
                class="toggle"
                @click=${() => {
                  this._toggleAllAudienceContent()
                }}
              >
                ${this._anyAudienceContentClosed ? 'Expand all' : 'Collapse all'}
              </button>
            </p>
          `
        : nothing}

      <div class="container">
        ${filteredAudienceEntries.length
          ? filteredAudienceEntries.map(
              ([audience, optimizations]) => html`
                <ctfl-opt-preview-audience
                  .open=${audienceContentOpenByKey[audience.sys.id] ?? true}
                  .audience=${audience}
                  .optimizations=${optimizations}
                  .defaultSelectedOptimizations=${audienceDefaultSelectedOptimizations.get(
                    audience,
                  )}
                  @ctfl_opt_preview_audience_content_toggle=${this._onAudienceContentToggle}
                ></ctfl-opt-preview-audience>
              `,
            )
          : html`
              <div class="no-results">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M10 4C6.68629 4 4 6.68629 4 10C4 13.3137 6.68629 16 10 16C13.3137 16 16 13.3137 16 10C16 6.68629 13.3137 4 10 4ZM2 10C2 5.58172 5.58172 2 10 2C14.4183 2 18 5.58172 18 10C18 11.8487 17.3729 13.551 16.3199 14.9056L21.7071 20.2929C22.0976 20.6834 22.0976 21.3166 21.7071 21.7071C21.3166 22.0976 20.6834 22.0976 20.2929 21.7071L14.9056 16.3199C13.551 17.3729 11.8487 18 10 18C5.58172 18 2 14.4183 2 10Z"
                  ></path>
                  <path
                    d="M12.8286 7.1712C13.2191 7.56173 13.2191 8.19489 12.8286 8.58542L11.4143 9.99963L12.8286 11.4138C13.2191 11.8044 13.2191 12.4375 12.8286 12.8281C12.438 13.2186 11.8049 13.2186 11.4143 12.8281L10.0001 11.4138L8.58591 12.8281C8.19538 13.2186 7.56222 13.2186 7.17169 12.8281C6.78117 12.4375 6.78117 11.8044 7.17169 11.4138L8.58591 9.99963L7.17169 8.58542C6.78117 8.19489 6.78117 7.56173 7.17169 7.1712C7.56222 6.78068 8.19538 6.78068 8.58591 7.1712L10.0001 8.58542L11.4143 7.1712C11.8049 6.78068 12.438 6.78068 12.8286 7.1712Z"
                  ></path>
                </svg>
                <p>No results were found for your search.</p>
                <p>Try again with a different term.</p>
              </div>
            `}
      </div>
    `
  }

  static styles = css`
    :host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 0.75rem;
      min-height: 0;
    }

    p {
      margin: 0;
    }

    .toggle {
      all: unset;
      box-sizing: border-box;
      display: flex;
      gap: 0.25rem;
      cursor: pointer;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1.25rem;
      color: #8c2eea;
      -webkit-appearance: none;
      appearance: none;
    }

    .toggle:active,
    .toggle:focus,
    .toggle:hover {
      text-decoration: underline;
    }

    .container {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 1rem;
      min-height: 0;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .container::-webkit-scrollbar {
      display: none;
    }

    .no-results {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 0.75rem;
      height: 100%;
      text-align: center;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .no-results-text {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
    }

    .no-results p {
      margin: 0;
      color: rgb(17, 24, 39);
    }

    .no-results svg {
      width: 4rem;
      color: rgb(156, 163, 175);
    }
  `
}

/**
 * Registers the {@link Audiences} custom element if not already defined.
 *
 * @example
 * ```ts
 * defineAudiences()
 * ```
 *
 * @public
 */
export function defineAudiences(): void {
  if (!customElements.get(AUDIENCES_TAG)) {
    customElements.define(AUDIENCES_TAG, Audiences)
  }
}

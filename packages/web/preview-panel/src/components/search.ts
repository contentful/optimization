import { css, html, LitElement, nothing, type TemplateResult } from 'lit'
import { property, state } from 'lit/decorators.js'

/** @internal */
function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Event name dispatched when the search query changes.
 *
 * @public
 */
export const SEARCH_CHANGE = 'ctfl-opt-preview-search-change' as const

/**
 * Custom event carrying the normalized search query.
 *
 * @public
 */
export type SearchChangeEvent = CustomEvent<string>

/**
 * Type guard that checks whether an event is a {@link SearchChangeEvent}.
 *
 * @param event - The DOM event to check.
 * @returns `true` if the event is a `CustomEvent` with a string detail.
 *
 * @public
 */
export function isSearchChangeEvent(event: Event): event is SearchChangeEvent {
  return event instanceof CustomEvent && typeof event.detail === 'string'
}

/**
 * Custom element tag name for {@link Search}.
 *
 * @public
 */
export const SEARCH_TAG = 'ctfl-opt-preview-search' as const

/**
 * Type guard that checks whether an element is a {@link Search}.
 *
 * @param element - The element to check.
 * @returns `true` if the element's tag matches {@link SEARCH_TAG}.
 *
 * @example
 * ```ts
 * if (isSearch(el)) {
 *   el.label = 'Find audiences'
 * }
 * ```
 *
 * @public
 */
export function isSearch(element?: Element): element is Search {
  return element?.tagName === SEARCH_TAG.toUpperCase()
}

/**
 * Search input used to filter preview audiences and personalizations.
 *
 * Emits {@link SEARCH_CHANGE} with the normalized query whenever the user
 * types or clears the current search query.
 *
 * @see {@link LitElement}
 *
 * @public
 */
export class Search extends LitElement {
  /** Current raw input value owned by the search component. */
  @state()
  private accessor _value = ''

  /** Accessible label for the search input. */
  @property({ type: String })
  accessor label = 'Search Audiences and Personalizations'

  /** Placeholder shown when the search input is empty. */
  @property({ type: String })
  accessor placeholder = 'Search Audiences and Personalizations'

  /** @internal */
  private _setValue(value: string): void {
    this._value = value
    this.dispatchEvent(
      new CustomEvent<string>(SEARCH_CHANGE, {
        detail: normalizeSearchValue(value),
        bubbles: true,
        composed: true,
      }),
    )
  }

  /** @internal */
  private _onInput(event: Event): void {
    if (!(event.currentTarget instanceof HTMLInputElement)) return
    this._setValue(event.currentTarget.value)
  }

  /** @internal */
  private _clear(): void {
    this._setValue('')
  }

  /** @internal */
  protected render(): TemplateResult {
    return html`
      <label class="search">
        <span class="search-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            ></path>
          </svg>
        </span>

        <input
          type="search"
          name="search"
          .value=${this._value}
          placeholder=${this.placeholder}
          aria-label=${this.label}
          autocomplete="off"
          spellcheck="false"
          @input=${(event: Event) => {
            this._onInput(event)
          }}
        />

        ${this._value
          ? html`
              <button
                type="button"
                class="search-clear"
                aria-label="Clear search"
                @click=${() => {
                  this._clear()
                }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fill-rule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  ></path>
                </svg>
              </button>
            `
          : nothing}
      </label>
    `
  }

  static styles = css`
    :host {
      display: block;
    }

    .search {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.5rem;
      padding: 0 calc(1rem - 1px);
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      background: #fff;
    }

    .search:focus-within {
      outline: 2px solid #7025bb;
      outline-offset: -2px;
    }

    .search-icon {
      display: flex;
      color: rgb(156, 163, 175);
    }

    .search-icon svg {
      width: 1.25rem;
      height: 1.25rem;
    }

    .search input {
      min-width: 0;
      padding: 0.3125rem 0;
      border: 0;
      font: inherit;
      color: inherit;
      line-height: 1.5rem;
      background: transparent;
    }

    .search input::placeholder {
      font-size: 0.875rem;
      color: rgb(156, 163, 175);
    }

    .search input:focus {
      outline: 0;
    }

    .search input::-webkit-search-cancel-button {
      -webkit-appearance: none;
      appearance: none;
    }

    .search-clear {
      all: unset;
      display: flex;
      cursor: pointer;
      font-size: 0.875rem;
      line-height: 1.25rem;
      color: rgb(156, 163, 175);
    }

    .search-clear:hover,
    .search-clear:focus-visible {
      text-decoration: underline;
    }

    .search-clear svg {
      width: 1rem;
      height: 1rem;
    }
  `
}

/**
 * Registers the {@link Search} custom element if not already defined.
 *
 * @example
 * ```ts
 * defineSearch()
 * ```
 *
 * @public
 */
export function defineSearch(): void {
  if (!customElements.get(SEARCH_TAG)) {
    customElements.define(SEARCH_TAG, Search)
  }
}

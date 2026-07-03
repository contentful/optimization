/**
 * Consent value accepted by stateful SDK `consent()` methods.
 *
 * Pass `true` or `false` to update event consent and the persistence consent value together. The
 * persistence consent value controls durable profile-continuity storage. Pass an object when an
 * application needs to update either capability independently, such as allowing events while keeping
 * profile continuity session-only.
 */
export type ConsentInput = boolean | { events?: boolean; persistence?: boolean }

/**
 * Controller for updating the current consent state.
 *
 * @internal
 * @remarks
 * Intended for internal wiring between Core classes and the consent signal/store.
 */
export interface ConsentController {
  /**
   * Update the runtime consent state.
   *
   * @param accept - `true` or `false` for both event consent and the persistence consent value, or
   * an object to update either consent capability independently. Persistence consent controls
   * durable profile-continuity storage.
   */
  consent: (accept: ConsentInput) => void
}

/**
 * Contract implemented by classes that gate operations based on consent.
 *
 * @internal
 * @remarks
 * This predicate is consumed by consent-gated send paths to decide whether to proceed with an
 * operation.
 */
export interface ConsentGuard {
  /**
   * Determine whether the named operation is permitted given current consent and
   * any allow‑list configuration.
   *
   * @param name - Logical operation/method name (e.g., `'track'`, `'page'`).
   * @returns `true` if the operation can proceed; otherwise `false`.
   * @remarks
   * The mapping between method names and event type strings can be product‑specific.
   */
  hasConsent: (name: string) => boolean
}

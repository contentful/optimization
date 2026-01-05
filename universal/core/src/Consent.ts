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
   * @param accept - `true` when the user has granted consent; `false` otherwise.
   */
  consent: (accept: boolean) => void
}

/**
 * Contract implemented by classes that gate operations based on consent.
 *
 * @internal
 * @remarks
 * These methods are consumed by the `@guardedBy` decorator to decide whether to
 * proceed with an operation and how to report blocked calls.
 */
export interface ConsentGuard {
  /**
   * Determine whether the named operation is permitted given current consent and
   * any allow‑list configuration.
   *
   * @param name - Logical operation/method name (e.g., `'track'`, `'page'`).
   * @returns `true` if the operation may proceed; otherwise `false`.
   * @remarks
   * The mapping between method names and event type strings may be product‑specific.
   */
  hasConsent: (name: string) => boolean

  /**
   * Hook invoked when an operation is blocked due to missing consent.
   *
   * @param name - The blocked operation/method name.
   * @param args - The original call arguments, provided for diagnostics/telemetry.
   * @returns Nothing. Implementations typically log and/or emit diagnostics.
   */
  onBlockedByConsent: (name: string, args: unknown[]) => void
}

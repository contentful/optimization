/**
 * Execute a callback and route both sync and async failures to an optional
 * error handler.
 *
 * @param invoke - Callback to execute.
 * @param onError - Optional error handler invoked when `invoke` throws or
 * rejects.
 *
 * @remarks
 * Errors thrown by `onError` are intentionally swallowed so one failing
 * subscriber does not break fan-out behavior.
 *
 * @public
 */
export function safeCall(invoke: () => unknown, onError?: (error: unknown) => void): void {
  try {
    const result = invoke()

    Promise.resolve(result).catch((error: unknown) => {
      safeHandleError(error, onError)
    })
  } catch (error) {
    safeHandleError(error, onError)
  }
}

/**
 * Execute a callback and await completion while routing sync and async failures
 * to an optional error handler.
 *
 * @param invoke - Callback to execute.
 * @param onError - Optional error handler invoked when `invoke` throws or
 * rejects.
 *
 * @remarks
 * Unlike {@link safeCall}, this helper is awaitable and can be used when
 * callback side-effects must stay synchronized.
 *
 * Errors thrown by `onError` are intentionally swallowed so one failing
 * subscriber does not break fan-out behavior.
 *
 * @public
 */
export async function safeCallAsync(
  invoke: () => unknown,
  onError?: (error: unknown) => unknown,
): Promise<void> {
  try {
    await invoke()
  } catch (error) {
    await safeHandleErrorAsync(error, onError)
  }
}

function safeHandleError(error: unknown, onError?: (error: unknown) => void): void {
  if (!onError) return

  try {
    onError(error)
  } catch {
    // Intentionally ignore onError failures so subscriber fanout remains isolated.
  }
}

async function safeHandleErrorAsync(
  error: unknown,
  onError?: (error: unknown) => unknown,
): Promise<void> {
  if (!onError) return

  try {
    await onError(error)
  } catch {
    // Intentionally ignore onError failures so subscriber fanout remains isolated.
  }
}

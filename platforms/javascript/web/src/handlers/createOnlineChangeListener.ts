import { logger } from '@contentful/optimization-core'
import { CAN_ADD_LISTENERS } from '../global-constants'

const LOG_LOCATION = 'Web:Network'

/**
 * Callback invoked when the browser's connectivity state changes.
 *
 * The callback receives `true` when the browser is online and `false` when it is offline.
 *
 * @internal
 */
type Callback = (isOnline: boolean) => Promise<void> | void

/**
 * Create an online/offline listener that invokes a callback whenever the browser transitions
 * between connectivity states, and returns a cleanup function to remove all listeners.
 *
 * @param callback - Function invoked when the browser goes online (`true`) or offline (`false`).
 *   May return a promise.
 * @returns A function that removes the registered event listeners when called.
 *
 * @public
 * @remarks
 * - If the environment cannot add listeners (e.g., SSR), a no-op cleanup function is returned.
 * - If `navigator.onLine` is available, the callback is invoked immediately with the initial state.
 *
 * @example
 * ```ts
 * const cleanup = createOnlineChangeListener(async (isOnline) => {
 *   if (isOnline) await sdk.analytics.flush()
 * })
 *
 * // Later:
 * cleanup()
 * ```
 */
export function createOnlineChangeListener(callback: Callback): () => void {
  if (!CAN_ADD_LISTENERS) {
    return () => {
      void 0
    }
  }

  const emit = (isOnline: boolean): void => {
    void (async () => {
      try {
        await callback(isOnline)
      } catch (error) {
        logger.error(LOG_LOCATION, 'Error in online state callback:', error)
      }
    })()
  }

  const onOnline = (): void => {
    emit(true)
  }
  const onOffline = (): void => {
    emit(false)
  }

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  // Emit initial state (best-effort). If `navigator.onLine` is unavailable, default to `true`.
  emit(typeof navigator.onLine === 'boolean' ? navigator.onLine : true)

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}

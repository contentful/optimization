import { logger } from '@contentful/optimization-core'
import { AppState } from 'react-native'

/**
 * Callback invoked when the app transitions to background or inactive state.
 *
 * @internal
 */
type Callback = () => Promise<void> | void

/**
 * Create an app state listener that invokes a callback when the app goes to background
 * or becomes inactive, and returns a cleanup function to remove the listener.
 *
 * @param callback - Function invoked when the app transitions to background or inactive state.
 *   May return a promise.
 * @returns A function that removes the registered event listener when called.
 *
 * @public
 * @remarks
 * - On iOS, `inactive` state occurs during transitions (e.g., opening control center).
 * - On Android, `inactive` state is not commonly used.
 * - Both `background` and `inactive` trigger the callback to ensure events are flushed
 *   before the app may be suspended.
 *
 * @example
 * ```ts
 * const cleanup = createAppStateChangeListener(async () => {
 *   await sdk.flush()
 * })
 *
 * // Later:
 * cleanup()
 * ```
 */
export function createAppStateChangeListener(callback: Callback): () => void {
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      void (async () => {
        try {
          await callback()
        } catch (error) {
          logger.error('Error in app state callback:', error)
        }
      })()
    }
  })

  return () => {
    subscription.remove()
  }
}

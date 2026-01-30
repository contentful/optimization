import { createScopedLogger } from '@contentful/optimization-core'
import { CAN_ADD_LISTENERS } from '../global-constants'

const logger = createScopedLogger('Web:Visibility')

/**
 * Event type for browser page-hide / visibility-change events.
 *
 * @internal
 */
type HideEvent = Event | PageTransitionEvent

/**
 * Callback type invoked when the page is being hidden.
 *
 * @internal
 */
type Callback = (event: HideEvent) => Promise<void> | void

/**
 * Create a visibility-change listener that invokes a callback when the page
 * is hidden, and returns a cleanup function to remove all listeners.
 *
 * @param callback - Function invoked once when the page is being hidden, or
 * when a pagehide event occurs. May return a promise.
 * @returns A function that removes all registered event listeners when called.
 *
 * @public
 * @remarks
 * The callback is guaranteed to be invoked at most once per hide cycle until
 * the next visibility or page show event resets the internal state. If the
 * environment does not permit adding listeners (e.g., server-side rendering),
 * a no-op cleanup function is returned.
 *
 * @example
 * ```ts
 * const cleanup = createVisibilityChangeListener(async () => {
 *   await flushPendingEvents()
 * })
 *
 * // Later, when teardown is needed:
 * cleanup()
 * ```
 */
export function createVisibilityChangeListener(callback: Callback): () => void {
  if (!CAN_ADD_LISTENERS) {
    return () => {
      void 0
    }
  }

  let handled = false

  const handleHide = (event: HideEvent): void => {
    if (handled) return
    handled = true

    void (async () => {
      try {
        await callback(event)
      } catch (error) {
        logger.error('Error handling page visibility change:', error)
      }
    })()
  }

  const resetHandled = (): void => {
    handled = false
  }

  const onVisibilityChange = (event: Event): void => {
    if (document.visibilityState === 'hidden') {
      handleHide(event)
    } else {
      resetHandled()
    }
  }

  const onPageHide = (event: PageTransitionEvent): void => {
    handleHide(event)
  }

  const onPageShow = (): void => {
    resetHandled()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('pageshow', onPageShow)

  // Cleanup function
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('pageshow', onPageShow)
  }
}

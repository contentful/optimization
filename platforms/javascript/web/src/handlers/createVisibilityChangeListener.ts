import { logger } from '@contentful/optimization-core'
import { CAN_ADD_LISTENERS } from '../global-constants'

type HideEvent = Event | PageTransitionEvent
type Callback = (event: HideEvent) => Promise<void> | void

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
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger.error(
          '[Optimization Web SDK] Error encountered while handling page visibility change:',
          message,
        )
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

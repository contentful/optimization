import { CAN_ADD_LISTENERS } from '../../constants'

export type Timer = ReturnType<typeof setTimeout>
export type Interval = ReturnType<typeof setInterval>

export interface WeakRefState {
  ref: WeakRef<Element> | null
  strongRef: Element | null
}

export interface FireTimerState {
  fireTimer: Timer | null
}

export const NOW = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

export const isPageVisible = (): boolean =>
  !CAN_ADD_LISTENERS ? true : document.visibilityState === 'visible'

export const addVisibilityChangeListener = (
  handler: (isVisible: boolean) => void,
): (() => void) | undefined => {
  if (!CAN_ADD_LISTENERS) return undefined

  const onVisibilityChange = (): void => {
    handler(isPageVisible())
  }
  const onPageHide = (): void => {
    handler(false)
  }
  const onBeforeUnload = (): void => {
    handler(false)
  }
  const onPageShow = (): void => {
    handler(true)
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('beforeunload', onBeforeUnload)
  window.addEventListener('pageshow', onPageShow)

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('beforeunload', onBeforeUnload)
    window.removeEventListener('pageshow', onPageShow)
  }
}

export const clearFireTimer = (state: FireTimerState): void => {
  if (state.fireTimer !== null) {
    clearTimeout(state.fireTimer)
    state.fireTimer = null
  }
}

export const derefElement = (state: WeakRefState): Element | null => {
  if (state.ref && typeof state.ref.deref === 'function') {
    const element = state.ref.deref()
    if (element) return element
  }

  return state.strongRef ?? null
}

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

export const addVisibilityChangeListener = (handler: () => void): (() => void) | undefined => {
  if (!CAN_ADD_LISTENERS) return undefined

  document.addEventListener('visibilitychange', handler)

  return () => {
    document.removeEventListener('visibilitychange', handler)
  }
}

export const Num = {
  n: (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback),
  clamp01: (value: number | undefined, fallback: number): number =>
    Math.min(1, Math.max(0, Num.n(value, fallback))),
  nonNeg: (value: number | undefined, fallback: number): number =>
    Math.max(0, Num.n(value, fallback)),
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

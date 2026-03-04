import {
  clearFireTimer,
  derefElement,
  type FireTimerState,
  type Interval,
  type WeakRefState,
} from './observerSupport'

interface ObserverLifecycleState extends WeakRefState, FireTimerState {
  done: boolean
}

interface ObserverStateCollection<TState extends ObserverLifecycleState> {
  activeStates: Set<TState>
  states: WeakMap<Element, TState>
}

export const ensureSweeper = (
  current: Interval | null,
  sweep: () => void,
  intervalMs: number,
): Interval => {
  if (current !== null) return current

  return setInterval(() => {
    sweep()
  }, intervalMs)
}

export const stopSweeper = (current: Interval | null): Interval | null => {
  if (current === null) return current

  clearInterval(current)
  return null
}

export const finalizeDroppedState = <TState extends ObserverLifecycleState>(
  state: TState,
  { activeStates, states }: ObserverStateCollection<TState>,
): void => {
  clearFireTimer(state)
  state.done = true
  activeStates.delete(state)

  if (state.strongRef) {
    states.delete(state.strongRef)
    state.strongRef = null
  }
}

export const safeAutoUnobserve = <TState extends ObserverLifecycleState>(
  element: Element,
  state: TState,
  { activeStates, states }: ObserverStateCollection<TState>,
  unobserve: (target: Element) => void,
): void => {
  try {
    unobserve(element)
  } catch {
    activeStates.delete(state)

    if (state.strongRef === element) {
      states.delete(element)
      state.strongRef = null
    }

    state.done = true
  }
}

export const sweepOrphans = <TState extends ObserverLifecycleState>(
  { activeStates, states }: ObserverStateCollection<TState>,
  unobserve: (target: Element) => void,
): void => {
  for (const state of activeStates) {
    const element = derefElement(state)

    if (!element) {
      finalizeDroppedState(state, { activeStates, states })
      continue
    }

    const isConnected =
      typeof (element as Element & { isConnected?: boolean }).isConnected === 'boolean'
        ? (element as Element & { isConnected?: boolean }).isConnected
        : typeof document !== 'undefined' && document.contains(element)

    if (!isConnected) {
      safeAutoUnobserve(element, state, { activeStates, states }, unobserve)
    }
  }
}

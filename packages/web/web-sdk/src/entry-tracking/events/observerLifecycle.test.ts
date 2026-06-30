import {
  ensureSweeper,
  finalizeDroppedState,
  safeAutoUnobserve,
  stopSweeper,
  sweepOrphans,
} from './observerLifecycle'
import type { FireTimerState, Interval, WeakRefState } from './observerSupport'

interface LifecycleState extends WeakRefState, FireTimerState {
  done: boolean
}

const makeState = (overrides: Partial<LifecycleState> = {}): LifecycleState => ({
  ref: null,
  strongRef: null,
  fireTimer: null,
  done: false,
  ...overrides,
})

const makeCollection = (): {
  activeStates: Set<LifecycleState>
  states: WeakMap<Element, LifecycleState>
} => ({
  activeStates: new Set(),
  states: new WeakMap(),
})

beforeEach(() => {
  rs.useRealTimers()
})

afterEach(() => {
  rs.restoreAllMocks()
  rs.useRealTimers()
})

describe('ensureSweeper', () => {
  beforeEach(() => {
    rs.useFakeTimers()
  })

  it('creates an interval when none exists', () => {
    const sweep = rs.fn()
    const setIntervalSpy = rs.spyOn(globalThis, 'setInterval')

    const handle = ensureSweeper(null, sweep, 1000)

    expect(handle).not.toBeNull()
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    rs.advanceTimersByTime(2500)
    expect(sweep).toHaveBeenCalledTimes(2)

    clearInterval(handle)
  })

  it('returns the existing interval without creating another', () => {
    const sweep = rs.fn()
    const existing = setInterval(() => undefined, 1000)
    const setIntervalSpy = rs.spyOn(globalThis, 'setInterval')

    const handle = ensureSweeper(existing, sweep, 1000)

    expect(handle).toBe(existing)
    expect(setIntervalSpy).not.toHaveBeenCalled()

    clearInterval(existing)
  })
})

describe('stopSweeper', () => {
  it('clears an active interval and returns null', () => {
    const handle: Interval = setInterval(() => undefined, 1000)
    const clearIntervalSpy = rs.spyOn(globalThis, 'clearInterval')

    expect(stopSweeper(handle)).toBeNull()
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
    expect(clearIntervalSpy).toHaveBeenCalledWith(handle)
  })

  it('is a no-op when already stopped', () => {
    const clearIntervalSpy = rs.spyOn(globalThis, 'clearInterval')

    expect(stopSweeper(null)).toBeNull()
    expect(clearIntervalSpy).not.toHaveBeenCalled()
  })
})

describe('finalizeDroppedState', () => {
  it('clears fire timer, marks done, removes from activeStates, and clears strongRef', () => {
    const element = document.createElement('div')
    const fireTimer = setTimeout(() => undefined, 5000)
    const state = makeState({ strongRef: element, fireTimer })
    const collection = makeCollection()
    collection.activeStates.add(state)
    collection.states.set(element, state)
    const clearTimeoutSpy = rs.spyOn(globalThis, 'clearTimeout')

    finalizeDroppedState(state, collection)

    expect(clearTimeoutSpy).toHaveBeenCalledWith(fireTimer)
    expect(state.fireTimer).toBeNull()
    expect(state.done).toBe(true)
    expect(state.strongRef).toBeNull()
    expect(collection.activeStates.has(state)).toBe(false)
    expect(collection.states.has(element)).toBe(false)
  })

  it('handles state with no strong ref or timer', () => {
    const state = makeState()
    const collection = makeCollection()
    collection.activeStates.add(state)

    finalizeDroppedState(state, collection)

    expect(state.done).toBe(true)
    expect(state.strongRef).toBeNull()
    expect(collection.activeStates.has(state)).toBe(false)
  })
})

describe('safeAutoUnobserve', () => {
  it('calls unobserve and leaves state untouched on success', () => {
    const element = document.createElement('div')
    const state = makeState({ strongRef: element })
    const collection = makeCollection()
    collection.activeStates.add(state)
    collection.states.set(element, state)
    const unobserve = rs.fn()

    safeAutoUnobserve(element, state, collection, unobserve)

    expect(unobserve).toHaveBeenCalledWith(element)
    expect(state.done).toBe(false)
    expect(collection.activeStates.has(state)).toBe(true)
    expect(collection.states.has(element)).toBe(true)
  })

  it('cleans up state when unobserve throws', () => {
    const element = document.createElement('div')
    const state = makeState({ strongRef: element })
    const collection = makeCollection()
    collection.activeStates.add(state)
    collection.states.set(element, state)
    const unobserve = rs.fn(() => {
      throw new Error('unobserve-failed')
    })

    safeAutoUnobserve(element, state, collection, unobserve)

    expect(state.done).toBe(true)
    expect(state.strongRef).toBeNull()
    expect(collection.activeStates.has(state)).toBe(false)
    expect(collection.states.has(element)).toBe(false)
  })

  it('does not delete from states map when strongRef does not match the element', () => {
    const element = document.createElement('div')
    const otherElement = document.createElement('span')
    const state = makeState({ strongRef: otherElement })
    const collection = makeCollection()
    collection.activeStates.add(state)
    collection.states.set(otherElement, state)
    const unobserve = rs.fn(() => {
      throw new Error('unobserve-failed')
    })

    safeAutoUnobserve(element, state, collection, unobserve)

    expect(state.done).toBe(true)
    expect(state.strongRef).toBe(otherElement)
    expect(collection.states.has(otherElement)).toBe(true)
    expect(collection.activeStates.has(state)).toBe(false)
  })
})

describe('sweepOrphans', () => {
  it('finalizes states whose ref deref returns nothing and has no strong ref', () => {
    const placeholder = document.createElement('div')
    const ref = new WeakRef(placeholder)
    rs.spyOn(ref, 'deref').mockReturnValue(undefined)
    const state = makeState({ ref, strongRef: null })
    const collection = makeCollection()
    collection.activeStates.add(state)
    const unobserve = rs.fn()

    sweepOrphans(collection, unobserve)

    expect(state.done).toBe(true)
    expect(collection.activeStates.has(state)).toBe(false)
    expect(unobserve).not.toHaveBeenCalled()
  })

  it('uses isConnected to decide whether to unobserve', () => {
    const connected = document.createElement('div')
    document.body.appendChild(connected)
    const detached = document.createElement('div')

    const stateConnected = makeState({ strongRef: connected })
    const stateDetached = makeState({ strongRef: detached })
    const collection = makeCollection()
    collection.activeStates.add(stateConnected)
    collection.activeStates.add(stateDetached)
    collection.states.set(connected, stateConnected)
    collection.states.set(detached, stateDetached)

    const unobserve = rs.fn()

    sweepOrphans(collection, unobserve)

    expect(unobserve).toHaveBeenCalledTimes(1)
    expect(unobserve).toHaveBeenCalledWith(detached)
    expect(stateConnected.done).toBe(false)

    connected.remove()
  })
})

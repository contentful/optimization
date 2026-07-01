import {
  acquireStatefulRuntimeSingleton,
  releaseStatefulRuntimeSingleton,
} from './StatefulRuntimeSingleton'

type SingletonGlobal = typeof globalThis & {
  __ctfl_optimization_stateful_runtime_lock__?: unknown
}

function clearLock(): void {
  const g = globalThis as SingletonGlobal
  g.__ctfl_optimization_stateful_runtime_lock__ = undefined
}

describe('StatefulRuntimeSingleton — Node (no window)', () => {
  beforeEach(() => {
    clearLock()
  })
  afterEach(() => {
    clearLock()
  })

  it('does not throw when acquiring on server', () => {
    expect(() => {
      acquireStatefulRuntimeSingleton('owner-1')
    }).not.toThrow()
  })

  it('does not throw on a second acquire on server — no lock contention', () => {
    acquireStatefulRuntimeSingleton('owner-1')
    expect(() => {
      acquireStatefulRuntimeSingleton('owner-2')
    }).not.toThrow()
  })

  it('does not throw when releasing on server', () => {
    acquireStatefulRuntimeSingleton('owner-1')
    expect(() => {
      releaseStatefulRuntimeSingleton('owner-1')
    }).not.toThrow()
  })

  it('allows repeated acquire/release cycles on server', () => {
    for (let i = 0; i < 3; i++) {
      const owner = `owner-${i}`
      expect(() => {
        acquireStatefulRuntimeSingleton(owner)
      }).not.toThrow()
      expect(() => {
        releaseStatefulRuntimeSingleton(owner)
      }).not.toThrow()
    }
  })
})

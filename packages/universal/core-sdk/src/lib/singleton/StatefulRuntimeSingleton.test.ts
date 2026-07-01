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

describe('StatefulRuntimeSingleton — enforce: true (browser)', () => {
  beforeEach(() => {
    clearLock()
  })
  afterEach(() => {
    clearLock()
  })

  it('acquires the lock for the first owner', () => {
    expect(() => {
      acquireStatefulRuntimeSingleton('owner-1', true)
    }).not.toThrow()
  })

  it('throws when a second owner tries to acquire a held lock', () => {
    acquireStatefulRuntimeSingleton('owner-1', true)

    expect(() => {
      acquireStatefulRuntimeSingleton('owner-2', true)
    }).toThrowError(/already initialized/i)
  })

  it('releases the lock so a new owner can acquire it', () => {
    acquireStatefulRuntimeSingleton('owner-1', true)
    releaseStatefulRuntimeSingleton('owner-1', true)

    expect(() => {
      acquireStatefulRuntimeSingleton('owner-2', true)
    }).not.toThrow()
  })

  it('does not release the lock when a different owner calls release', () => {
    acquireStatefulRuntimeSingleton('owner-1', true)
    releaseStatefulRuntimeSingleton('owner-2', true)

    expect(() => {
      acquireStatefulRuntimeSingleton('owner-3', true)
    }).toThrowError(/already initialized/i)
  })

  it('allows repeated acquire/release cycles', () => {
    for (let i = 0; i < 3; i++) {
      const owner = `owner-${i}`
      expect(() => {
        acquireStatefulRuntimeSingleton(owner, true)
      }).not.toThrow()
      expect(() => {
        releaseStatefulRuntimeSingleton(owner, true)
      }).not.toThrow()
    }
  })
})

describe('StatefulRuntimeSingleton — enforce: false (server / SSR)', () => {
  beforeEach(() => {
    clearLock()
  })
  afterEach(() => {
    clearLock()
  })

  it('does not throw when acquiring', () => {
    expect(() => {
      acquireStatefulRuntimeSingleton('owner-1', false)
    }).not.toThrow()
  })

  it('does not throw on a second acquire — no lock contention', () => {
    acquireStatefulRuntimeSingleton('owner-1', false)

    expect(() => {
      acquireStatefulRuntimeSingleton('owner-2', false)
    }).not.toThrow()
  })

  it('does not throw when releasing', () => {
    acquireStatefulRuntimeSingleton('owner-1', false)

    expect(() => {
      releaseStatefulRuntimeSingleton('owner-1', false)
    }).not.toThrow()
  })

  it('allows repeated acquire/release cycles — simulates multiple SSR requests', () => {
    for (let i = 0; i < 3; i++) {
      const owner = `owner-${i}`
      expect(() => {
        acquireStatefulRuntimeSingleton(owner, false)
      }).not.toThrow()
      expect(() => {
        releaseStatefulRuntimeSingleton(owner, false)
      }).not.toThrow()
    }
  })
})

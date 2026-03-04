const STATEFUL_RUNTIME_LOCK_KEY = '__ctfl_optimization_stateful_runtime_lock__'

interface StatefulRuntimeLockState {
  owner: string | undefined
}

type SingletonGlobal = typeof globalThis & {
  __ctfl_optimization_stateful_runtime_lock__?: StatefulRuntimeLockState
}

const getStatefulRuntimeLock = (): StatefulRuntimeLockState => {
  const singletonGlobal = globalThis as SingletonGlobal

  singletonGlobal[STATEFUL_RUNTIME_LOCK_KEY] ??= { owner: undefined }

  return singletonGlobal[STATEFUL_RUNTIME_LOCK_KEY]
}

export const acquireStatefulRuntimeSingleton = (owner: string): void => {
  const lock = getStatefulRuntimeLock()

  if (lock.owner) {
    throw new Error(
      `Stateful Optimization SDK already initialized (${lock.owner}). Only one stateful instance is supported per runtime.`,
    )
  }

  lock.owner = owner
}

export const releaseStatefulRuntimeSingleton = (owner: string): void => {
  const lock = getStatefulRuntimeLock()

  if (lock.owner === owner) {
    lock.owner = undefined
  }
}

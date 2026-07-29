let durableContinuityPersistenceSuppressed = false
let profilelessHandoffDurableContinuityPreserved = false

export function clearProfilelessHandoffDurableContinuity(): void {
  profilelessHandoffDurableContinuityPreserved = false
}

export function isDurableContinuityPersistenceSuppressed(): boolean {
  return durableContinuityPersistenceSuppressed
}

export function preserveProfilelessHandoffDurableContinuity(): void {
  profilelessHandoffDurableContinuityPreserved = true
}

export function shouldSkipDurableContinuityPersistence(hasProfile: boolean): boolean {
  return (
    durableContinuityPersistenceSuppressed ||
    (profilelessHandoffDurableContinuityPreserved && !hasProfile)
  )
}

export function suppressDurableContinuityPersistence<T>(run: () => T): T {
  const previous = durableContinuityPersistenceSuppressed
  durableContinuityPersistenceSuppressed = true

  try {
    return run()
  } finally {
    durableContinuityPersistenceSuppressed = previous
  }
}

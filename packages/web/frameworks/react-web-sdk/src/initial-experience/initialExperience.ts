import type { OptimizationSdk } from '../context/OptimizationContext'
import { createScopedLogger } from '../logger'

const DEFAULT_INITIAL_EXPERIENCE_MAX_WAIT_MS = 3_000
const INVALID_MAX_WAIT_MESSAGE = 'initialExperience.maxWaitMs must be a positive finite number.'
const logger = createScopedLogger('React:InitialExperience')

export type InitialExperienceClient = Readonly<
  Pick<OptimizationSdk, 'identify' | 'screen' | 'track'>
>

type InitialExperienceRunResult = ReturnType<() => void> | PromiseLike<unknown>

export interface InitialExperienceOptions {
  readonly run: (client: InitialExperienceClient) => InitialExperienceRunResult
  /** Positive finite value; defaults to 3,000 ms. */
  readonly maxWaitMs?: number
  readonly onError?: (error: Error) => void
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function logError(error: Error): void {
  try {
    logger.error(error)
  } catch {
    // Logging is best-effort and must not block the initial page attempt.
  }
}

function reportError(error: unknown, onError: InitialExperienceOptions['onError']): void {
  const resolvedError = toError(error)

  if (onError === undefined) {
    logError(resolvedError)
    return
  }

  try {
    onError(resolvedError)
  } catch (onErrorFailure: unknown) {
    logError(toError(onErrorFailure))
  }
}

export function resolveInitialExperienceMaxWaitMs(maxWaitMs: number | undefined): number {
  const resolvedMaxWaitMs = maxWaitMs ?? DEFAULT_INITIAL_EXPERIENCE_MAX_WAIT_MS

  if (!Number.isFinite(resolvedMaxWaitMs) || resolvedMaxWaitMs <= 0) {
    throw new TypeError(INVALID_MAX_WAIT_MESSAGE)
  }

  return resolvedMaxWaitMs
}

export function createInitialExperienceClient(sdk: OptimizationSdk): InitialExperienceClient {
  return {
    identify: async (...args) => await sdk.identify(...args),
    screen: async (...args) => await sdk.screen(...args),
    track: async (...args) => await sdk.track(...args),
  }
}

export async function runInitialExperience(
  sdk: OptimizationSdk,
  options: InitialExperienceOptions,
  maxWaitMs: number,
): Promise<void> {
  let watchdog: ReturnType<typeof setTimeout> | undefined = undefined

  try {
    const returnedWork = options.run(createInitialExperienceClient(sdk))
    const { promise: watchdogPromise, reject: rejectWatchdog } = Promise.withResolvers<never>()
    watchdog = setTimeout(() => {
      rejectWatchdog(new Error(`initialExperience.run timed out after ${maxWaitMs} ms.`))
    }, maxWaitMs)

    await Promise.race([Promise.resolve(returnedWork), watchdogPromise])
  } catch (error: unknown) {
    reportError(error, options.onError)
  } finally {
    clearTimeout(watchdog)
  }
}

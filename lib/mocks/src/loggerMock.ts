interface MockFn {
  (...args: unknown[]): unknown
  mockClear: () => void
}

interface MockingApi {
  fn: () => MockFn
}

function hasFn(value: unknown): value is MockingApi {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return typeof Reflect.get(value, 'fn') === 'function'
}

function getGlobalCandidate(name: 'rs' | 'vi'): unknown {
  if (name === 'rs') {
    return 'rs' in globalThis ? Reflect.get(globalThis, 'rs') : undefined
  }

  return 'vi' in globalThis ? Reflect.get(globalThis, 'vi') : undefined
}

function resolveMockingApi(): MockingApi {
  const rsCandidate = getGlobalCandidate('rs')
  if (hasFn(rsCandidate)) {
    return rsCandidate
  }

  const viCandidate = getGlobalCandidate('vi')
  if (hasFn(viCandidate)) {
    return viCandidate
  }

  throw new Error('No test mock API available. Expected global "rs" (Rstest) or "vi" (Vitest).')
}

function createMockFn(): MockFn {
  return resolveMockingApi().fn()
}

export interface MockLogger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  fatal: (...args: unknown[]) => void
  addSink?: (sink: unknown) => void
  removeSink?: (name: string) => void
  removeSinks?: () => void
}

/**
 * Stub LogSink class for mocking the logger package.
 */
export abstract class LogSink {
  name = 'MockLogSink'
  abstract ingest(event: unknown): void
}

/**
 * Stub ConsoleLogSink class for mocking the logger package.
 * Stores ingested events for test inspection.
 */
export class ConsoleLogSink extends LogSink {
  override name = 'MockConsoleLogSink'
  readonly verbosity: string
  readonly events: unknown[] = []

  constructor(verbosity?: string) {
    super()
    this.verbosity = verbosity ?? 'error'
  }

  ingest(event: unknown): void {
    this.events.push(event)
  }
}

export interface MockScopedLogger {
  debug: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  log: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string | Error, ...args: unknown[]) => void
  fatal: (message: string | Error, ...args: unknown[]) => void
}

export interface TestMockLogger {
  debug: MockFn
  info: MockFn
  log: MockFn
  warn: MockFn
  error: MockFn
  fatal: MockFn
  addSink: MockFn
  removeSink: MockFn
  removeSinks: MockFn
}

/**
 * Pre-built mock logger with vitest spies for all log methods.
 * Import this in tests to assert on log calls.
 *
 * @example
 * ```typescript
 * import { mockLogger } from 'mocks'
 *
 * // In tests:
 * expect(mockLogger.info).toHaveBeenCalledWith('ModuleName', 'message')
 * ```
 */
export const mockLogger: TestMockLogger = {
  debug: createMockFn(),
  info: createMockFn(),
  log: createMockFn(),
  warn: createMockFn(),
  error: createMockFn(),
  fatal: createMockFn(),
  addSink: createMockFn(),
  removeSink: createMockFn(),
  removeSinks: createMockFn(),
}

export interface LoggerMockModule {
  logger: MockLogger
  createScopedLogger: (location: string) => MockScopedLogger
  ConsoleLogSink: typeof ConsoleLogSink
  LogSink: typeof LogSink
}

/**
 * Creates a mock module for the logger package that includes both the global logger
 * and the createScopedLogger factory. The scoped logger routes calls to the mock logger
 * with the location prepended.
 *
 * @param logger - A mock logger object with spy functions for each method
 *
 * @example
 * ```typescript
 * import { mockLogger, createLoggerMock } from 'mocks'
 *
 * vi.mock('logger', () => createLoggerMock(mockLogger))
 *
 * // In tests:
 * expect(mockLogger.info).toHaveBeenCalledWith('ModuleName', 'message')
 * ```
 */
export function createLoggerMock(logger: MockLogger): LoggerMockModule {
  return {
    logger,
    createScopedLogger: (location: string) => ({
      debug: (message: string, ...args: unknown[]): void => {
        logger.debug(location, message, ...args)
      },
      info: (message: string, ...args: unknown[]): void => {
        logger.info(location, message, ...args)
      },
      log: (message: string, ...args: unknown[]): void => {
        logger.log(location, message, ...args)
      },
      warn: (message: string, ...args: unknown[]): void => {
        logger.warn(location, message, ...args)
      },
      error: (message: string | Error, ...args: unknown[]): void => {
        logger.error(location, message, ...args)
      },
      fatal: (message: string | Error, ...args: unknown[]): void => {
        logger.fatal(location, message, ...args)
      },
    }),
    ConsoleLogSink,
    LogSink,
  }
}

/**
 * Pre-built logger mock module ready for use with vi.mock().
 * Use this in setup files or test files for simple cases.
 *
 * @example
 * ```typescript
 * // In setup.ts or test file:
 * import { loggerMock } from 'mocks'
 *
 * vi.mock('logger', () => loggerMock)
 * ```
 */
export const loggerMock = createLoggerMock(mockLogger)

/**
 * Resets all mock logger spies. Call in beforeEach/afterEach.
 *
 * @example
 * ```typescript
 * import { resetMockLogger } from 'mocks'
 *
 * beforeEach(() => {
 *   resetMockLogger()
 * })
 * ```
 */
export function resetMockLogger(): void {
  mockLogger.debug.mockClear()
  mockLogger.info.mockClear()
  mockLogger.log.mockClear()
  mockLogger.warn.mockClear()
  mockLogger.error.mockClear()
  mockLogger.fatal.mockClear()
  mockLogger.addSink.mockClear()
  mockLogger.removeSink.mockClear()
  mockLogger.removeSinks.mockClear()
}

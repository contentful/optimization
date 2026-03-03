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

/**
 * Interface for a mock logger with standard log-level methods.
 *
 * @public
 */
export interface MockLogger {
  /** Logs at debug level. */
  debug: (...args: unknown[]) => void
  /** Logs at info level. */
  info: (...args: unknown[]) => void
  /** Logs at log level. */
  log: (...args: unknown[]) => void
  /** Logs at warn level. */
  warn: (...args: unknown[]) => void
  /** Logs at error level. */
  error: (...args: unknown[]) => void
  /** Logs at fatal level. */
  fatal: (...args: unknown[]) => void
  /** Optional method to register a log sink. */
  addSink?: (sink: unknown) => void
  /** Optional method to remove a log sink by name. */
  removeSink?: (name: string) => void
  /** Optional method to remove all log sinks. */
  removeSinks?: () => void
}

/**
 * Stub {@link LogSink} class for mocking the logger package.
 *
 * @public
 */
export abstract class LogSink {
  /** Identifies this mock sink. */
  name = 'MockLogSink'

  /**
   * Processes an incoming log event.
   *
   * @param event - The log event to process.
   * @returns Nothing.
   */
  abstract ingest(event: unknown): void
}

/**
 * Stub {@link ConsoleLogSink} class for mocking the logger package.
 * Stores ingested events for test inspection.
 *
 * @public
 */
export class ConsoleLogSink extends LogSink {
  /** Identifies this mock sink. */
  override name = 'MockConsoleLogSink'

  /**
   * Minimum log level for output.
   *
   * @defaultValue 'error'
   */
  readonly verbosity: string

  /** Accumulated events for test assertions. */
  readonly events: unknown[] = []

  /**
   * Creates a new mock ConsoleLogSink.
   *
   * @param verbosity - Minimum log level to accept.
   */
  constructor(verbosity?: string) {
    super()
    this.verbosity = verbosity ?? 'error'
  }

  /**
   * Stores the event for later test inspection.
   *
   * @param event - The log event to record.
   * @returns Nothing.
   */
  ingest(event: unknown): void {
    this.events.push(event)
  }
}

/**
 * Interface for a scoped mock logger whose methods include a message parameter.
 *
 * @public
 */
export interface MockScopedLogger {
  /** Logs at debug level. */
  debug: (message: string, ...args: unknown[]) => void
  /** Logs at info level. */
  info: (message: string, ...args: unknown[]) => void
  /** Logs at log level. */
  log: (message: string, ...args: unknown[]) => void
  /** Logs at warn level. */
  warn: (message: string, ...args: unknown[]) => void
  /** Logs at error level. */
  error: (message: string | Error, ...args: unknown[]) => void
  /** Logs at fatal level. */
  fatal: (message: string | Error, ...args: unknown[]) => void
}

/**
 * Interface for a test mock logger where every method is a spy that can be asserted on.
 *
 * @public
 */
export interface TestMockLogger {
  /** Debug-level spy. */
  debug: MockFn
  /** Info-level spy. */
  info: MockFn
  /** Log-level spy. */
  log: MockFn
  /** Warn-level spy. */
  warn: MockFn
  /** Error-level spy. */
  error: MockFn
  /** Fatal-level spy. */
  fatal: MockFn
  /** Spy for {@link MockLogger.addSink}. */
  addSink: MockFn
  /** Spy for {@link MockLogger.removeSink}. */
  removeSink: MockFn
  /** Spy for {@link MockLogger.removeSinks}. */
  removeSinks: MockFn
}

/**
 * Pre-built mock logger with test spies for all log methods.
 *
 * @example
 * ```typescript
 * import { mockLogger } from 'mocks'
 *
 * // In tests:
 * expect(mockLogger.info).toHaveBeenCalledWith('ModuleName', 'message')
 * ```
 *
 * @public
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

/**
 * Shape of the mock module returned by {@link createLoggerMock}.
 *
 * @public
 */
export interface LoggerMockModule {
  /** The mock logger instance. */
  logger: MockLogger
  /** Factory that creates a scoped logger bound to a location. */
  createScopedLogger: (location: string) => MockScopedLogger
  /** Mock {@link ConsoleLogSink} constructor. */
  ConsoleLogSink: typeof ConsoleLogSink
  /** Mock {@link LogSink} constructor. */
  LogSink: typeof LogSink
}

/**
 * Creates a mock module for an SDK logger entry point that includes both the global logger
 * and the {@link createScopedLogger} factory. The scoped logger routes calls to the
 * mock logger with the location prepended.
 *
 * @param logger - A mock logger object with spy functions for each method.
 * @returns A {@link LoggerMockModule} suitable for use with `vi.mock()`.
 *
 * @example
 * ```typescript
 * import { mockLogger, createLoggerMock } from 'mocks'
 *
 * vi.mock('@contentful/optimization-core/logger', () => createLoggerMock(mockLogger))
 *
 * // In tests:
 * expect(mockLogger.info).toHaveBeenCalledWith('ModuleName', 'message')
 * ```
 *
 * @public
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
 * Pre-built logger mock module ready for use with `vi.mock()`.
 *
 * @example
 * ```typescript
 * // In setup.ts or test file:
 * import { loggerMock } from 'mocks'
 *
 * vi.mock('@contentful/optimization-core/logger', () => loggerMock)
 * ```
 *
 * @public
 */
export const loggerMock = createLoggerMock(mockLogger)

/**
 * Resets all mock logger spies. Call in `beforeEach`/`afterEach` to isolate tests.
 *
 * @returns Nothing.
 *
 * @example
 * ```typescript
 * import { resetMockLogger } from 'mocks'
 *
 * beforeEach(() => {
 *   resetMockLogger()
 * })
 * ```
 *
 * @public
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

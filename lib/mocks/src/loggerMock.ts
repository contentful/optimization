export interface MockLogger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  fatal: (...args: unknown[]) => void
}

export interface MockScopedLogger {
  debug: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  log: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string | Error, ...args: unknown[]) => void
  fatal: (message: string | Error, ...args: unknown[]) => void
}

/**
 * Creates a mock module for the logger package that includes both the global logger
 * and the createScopedLogger factory. The scoped logger routes calls to the mock logger
 * with the location prepended.
 *
 * @param mockLogger - A mock logger object with spy functions for each method
 *
 * @example
 * ```typescript
 * const mockLogger = vi.hoisted(() => ({
 *   debug: vi.fn(),
 *   info: vi.fn(),
 *   log: vi.fn(),
 *   warn: vi.fn(),
 *   error: vi.fn(),
 *   fatal: vi.fn(),
 * }))
 *
 * vi.mock('logger', () => createLoggerMock(mockLogger))
 *
 * // In tests:
 * expect(mockLogger.info).toHaveBeenCalledWith('ModuleName', 'message')
 * ```
 */
export function createLoggerMock(mockLogger: MockLogger): {
  logger: MockLogger
  createScopedLogger: (location: string) => MockScopedLogger
} {
  return {
    logger: mockLogger,
    createScopedLogger: (location: string) => ({
      debug: (message: string, ...args: unknown[]): void => {
        mockLogger.debug(location, message, ...args)
      },
      info: (message: string, ...args: unknown[]): void => {
        mockLogger.info(location, message, ...args)
      },
      log: (message: string, ...args: unknown[]): void => {
        mockLogger.log(location, message, ...args)
      },
      warn: (message: string, ...args: unknown[]): void => {
        mockLogger.warn(location, message, ...args)
      },
      error: (message: string | Error, ...args: unknown[]): void => {
        mockLogger.error(location, message, ...args)
      },
      fatal: (message: string | Error, ...args: unknown[]): void => {
        mockLogger.fatal(location, message, ...args)
      },
    }),
  }
}

import type LogSink from './LogSink'
import type { LogEvent, LogLevels } from './logging'

/**
 * Central logger that routes log events through registered {@link LogSink} instances.
 *
 * @example
 * ```typescript
 * import { logger } from '@contentful/optimization-api-client/logger'
 *
 * logger.info('MyModule', 'Application started')
 * ```
 *
 * @public
 */
export class Logger {
  /** The logger's identifier, used as the event scope name. */
  readonly name = '@contentful/optimization'

  private readonly PREFIX_PARTS = ['Ctfl', 'O10n']
  private readonly DELIMITER = ':'
  private sinks: LogSink[] = []

  private assembleLocationPrefix(logLocation: string): string {
    return `[${[...this.PREFIX_PARTS, logLocation].join(this.DELIMITER)}]`
  }

  /**
   * Registers a log sink. If a sink with the same name already exists, it is replaced.
   *
   * @param sink - The {@link LogSink} instance to register.
   * @returns Nothing.
   *
   * @example
   * ```typescript
   * import { logger, ConsoleLogSink } from '@contentful/optimization-api-client/logger'
   *
   * logger.addSink(new ConsoleLogSink('debug'))
   * ```
   */
  public addSink(sink: LogSink): void {
    this.sinks = [...this.sinks.filter((existingSink) => existingSink.name !== sink.name), sink]
  }

  /**
   * Removes a registered sink by name.
   *
   * @param name - The name of the sink to remove.
   * @returns Nothing.
   *
   * @example
   * ```typescript
   * logger.removeSink('ConsoleLogSink')
   * ```
   */
  public removeSink(name: string): void {
    this.sinks = this.sinks.filter((sink) => sink.name !== name)
  }

  /**
   * Removes all registered sinks.
   *
   * @returns Nothing.
   *
   * @example
   * ```typescript
   * logger.removeSinks()
   * ```
   */
  public removeSinks(): void {
    this.sinks = []
  }

  /**
   * Logs a message at the debug level.
   *
   * @param logLocation - The module or component identifier.
   * @param message - The log message.
   * @param args - Additional arguments forwarded in the log event.
   * @returns Nothing.
   *
   * @example
   * ```typescript
   * logger.debug('MyModule', 'Debugging value', someVariable)
   * ```
   */
  public debug(logLocation: string, message: string, ...args: unknown[]): void {
    this.emit('debug', logLocation, message, ...args)
  }

  /**
   * Logs a message at the info level.
   *
   * @param logLocation - The module or component identifier.
   * @param message - The log message.
   * @param args - Additional arguments forwarded in the log event.
   * @returns Nothing.
   *
   * @example
   * ```typescript
   * logger.info('MyModule', 'Operation completed')
   * ```
   */
  public info(logLocation: string, message: string, ...args: unknown[]): void {
    this.emit('info', logLocation, message, ...args)
  }

  /**
   * Logs a message at the log level.
   *
   * @param logLocation - The module or component identifier.
   * @param message - The log message.
   * @param args - Additional arguments forwarded in the log event.
   * @returns Nothing.
   *
   * @example
   * ```typescript
   * logger.log('MyModule', 'General log entry')
   * ```
   */
  public log(logLocation: string, message: string, ...args: unknown[]): void {
    this.emit('log', logLocation, message, ...args)
  }

  /**
   * Logs a message at the warn level.
   *
   * @param logLocation - The module or component identifier.
   * @param message - The log message.
   * @param args - Additional arguments forwarded in the log event.
   * @returns Nothing.
   *
   * @example
   * ```typescript
   * logger.warn('MyModule', 'Deprecated method called')
   * ```
   */
  public warn(logLocation: string, message: string, ...args: unknown[]): void {
    this.emit('warn', logLocation, message, ...args)
  }

  /**
   * Logs a message at the error level.
   *
   * @param logLocation - The module or component identifier.
   * @param message - The log message or Error object.
   * @param args - Additional arguments forwarded in the log event.
   * @returns Nothing.
   *
   * @example
   * ```typescript
   * logger.error('MyModule', new Error('Something failed'))
   * ```
   */
  public error(logLocation: string, message: string | Error, ...args: unknown[]): void {
    this.emit('error', logLocation, message, ...args)
  }

  /**
   * Logs a message at the fatal level.
   *
   * @param logLocation - The module or component identifier.
   * @param message - The log message or Error object.
   * @param args - Additional arguments forwarded in the log event.
   * @returns Nothing.
   *
   * @example
   * ```typescript
   * logger.fatal('MyModule', new Error('Unrecoverable failure'))
   * ```
   */
  public fatal(logLocation: string, message: string | Error, ...args: unknown[]): void {
    this.emit('fatal', logLocation, message, ...args)
  }

  private emit(
    level: LogLevels,
    logLocation: string,
    message: string | Error,
    ...args: unknown[]
  ): void {
    this.onLogEvent({
      name: this.name,
      level,
      messages: [`${this.assembleLocationPrefix(logLocation)} ${String(message)}`, ...args],
    })
  }

  private onLogEvent(event: LogEvent): void {
    this.sinks.forEach((sink) => {
      sink.ingest(event)
    })
  }
}

/**
 * Shared singleton {@link Logger} instance used across the SDK.
 *
 * @public
 */
export const logger = new Logger()

/**
 * A location-scoped logger interface whose methods omit the `logLocation` parameter.
 *
 * @public
 */
export interface ScopedLogger {
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
 * Creates a {@link ScopedLogger} that automatically prepends the given location to every log call.
 *
 * @param location - The module or component identifier to prepend.
 * @returns A {@link ScopedLogger} bound to the specified location.
 *
 * @example
 * ```typescript
 * import { createScopedLogger } from '@contentful/optimization-api-client/logger'
 *
 * const log = createScopedLogger('MyModule')
 * log.info('Initialization complete')
 * ```
 *
 * @public
 */
export function createScopedLogger(location: string): ScopedLogger {
  return {
    debug: (message: string, ...args: unknown[]) => {
      logger.debug(location, message, ...args)
    },
    info: (message: string, ...args: unknown[]) => {
      logger.info(location, message, ...args)
    },
    log: (message: string, ...args: unknown[]) => {
      logger.log(location, message, ...args)
    },
    warn: (message: string, ...args: unknown[]) => {
      logger.warn(location, message, ...args)
    },
    error: (message: string | Error, ...args: unknown[]) => {
      logger.error(location, message, ...args)
    },
    fatal: (message: string | Error, ...args: unknown[]) => {
      logger.fatal(location, message, ...args)
    },
  }
}

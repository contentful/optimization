/* eslint-disable no-console -- using console */
import type { LogEvent, LogLevels } from 'diary'
import { compare } from 'diary/utils'
import LogSink from './LogSink'

const consoleMap = {
  debug: (...args: unknown[]) => {
    console.debug(...args)
  },
  info: (...args: unknown[]) => {
    console.info(...args)
  },
  log: (...args: unknown[]) => {
    console.log(...args)
  },
  warn: (...args: unknown[]) => {
    console.warn(...args)
  },
  error: (...args: unknown[]) => {
    console.error(...args)
  },
  fatal: (...args: unknown[]) => {
    console.error(...args)
  },
}

const COMPARISON_EQUALITY = 0

/**
 * A {@link LogSink} that writes log events to the browser or Node.js console,
 * filtering by a configurable verbosity threshold.
 *
 * @example
 * ```typescript
 * import { logger, ConsoleLogSink } from 'logger'
 *
 * logger.addSink(new ConsoleLogSink('debug'))
 * ```
 *
 * @public
 */
export class ConsoleLogSink extends LogSink {
  /** Identifies this sink when registered with the {@link Logger}. */
  public name = 'ConsoleLogSink'

  /**
   * Minimum log level required for events to be output.
   *
   * @defaultValue 'error'
   */
  readonly verbosity: LogLevels

  /**
   * Creates a new ConsoleLogSink.
   *
   * @param verbosity - Minimum log level to output.
   */
  constructor(verbosity?: LogLevels) {
    super()

    this.verbosity = verbosity ?? 'error'
  }

  /**
   * Writes a log event to the console if its level meets the verbosity threshold.
   *
   * @param event - The log event to process.
   * @returns Nothing.
   */
  ingest(event: LogEvent): void {
    if (compare(this.verbosity, event.level) > COMPARISON_EQUALITY) return

    consoleMap[event.level](...event.messages)
  }
}

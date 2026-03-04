/**
 * Supported log levels ordered from highest to lowest severity.
 *
 * @public
 */
export type LogLevels = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'log'

/**
 * A log event emitted by the logger package.
 *
 * @public
 */
export interface LogEvent {
  /** Logger scope name. */
  name: string
  /** Event severity level. */
  level: LogLevels
  /** Event payload, where the first entry is the formatted message. */
  messages: unknown[]
  /** Optional additional context attached by sinks or middleware. */
  [other: string]: unknown
}

/**
 * Numeric severity map used for log-level threshold comparisons.
 *
 * @public
 */
export const logLevelSeverity: Readonly<Record<LogLevels, number>> = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  log: 10,
}

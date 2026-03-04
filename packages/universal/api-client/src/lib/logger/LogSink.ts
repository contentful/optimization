import type { LogEvent } from './logging'

/**
 * Abstract base class for log sinks that receive and process log events.
 *
 * @example
 * ```typescript
 * class MyCustomSink extends LogSink {
 *   name = 'MyCustomSink'
 *
 *   ingest(event: LogEvent): void {
 *     // process the event
 *   }
 * }
 * ```
 *
 * @public
 */
abstract class LogSink {
  /** Display name used to identify this sink for addition and removal. */
  abstract name: string

  /**
   * Processes an incoming log event.
   *
   * @param event - The log event to process.
   * @returns Nothing.
   */
  abstract ingest(event: LogEvent): void
}

export default LogSink

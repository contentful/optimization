import type { LogEvent } from 'diary'

export type { LogEvent }

export default abstract class LogSink {
  abstract name: string

  abstract ingest(event: LogEvent): void
}

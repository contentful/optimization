import type { LogEvent } from 'diary'

export type { LogEvent }

abstract class LogSink {
  abstract name: string

  abstract ingest(event: LogEvent): void
}

export default LogSink

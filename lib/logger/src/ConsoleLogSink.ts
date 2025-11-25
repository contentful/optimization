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

export class ConsoleLogSink extends LogSink {
  public name = 'ConsoleLogSink'

  readonly verbosity: LogLevels

  constructor(verbosity?: LogLevels) {
    super()

    this.verbosity = verbosity ?? 'error'
  }

  ingest(event: LogEvent): void {
    if (compare(this.verbosity, event.level) > COMPARISON_EQUALITY) return

    consoleMap[event.level](...event.messages)
  }
}

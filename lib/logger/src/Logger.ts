import { diary, enable, type Diary, type LogEvent } from 'diary'

import type LogSink from './LogSink'

export class Logger {
  readonly name = '@contentful/optimization'

  private readonly PREFIX = '[Ctfl:O10n'
  private readonly diary: Diary
  private sinks: LogSink[] = []

  constructor() {
    this.diary = diary(this.name, this.onLogEvent.bind(this))
    enable(this.name)
  }

  public addSink(sink: LogSink): void {
    this.sinks = [...this.sinks.filter((existingSink) => existingSink.name !== sink.name), sink]
  }

  public removeSink(name: string): void {
    this.sinks = this.sinks.filter((sink) => sink.name !== name)
  }

  public removeSinks(): void {
    this.sinks = []
  }

  public debug(logLocation: string, message: string, ...args: unknown[]): void {
    this.diary.debug(`${this.PREFIX}:${logLocation}] ${message}`, ...args)
  }

  public info(logLocation: string, message: string, ...args: unknown[]): void {
    this.diary.info(`${this.PREFIX}:${logLocation}] ${message}`, ...args)
  }

  public log(logLocation: string, message: string, ...args: unknown[]): void {
    this.diary.log(`${this.PREFIX}:${logLocation}] ${message}`, ...args)
  }

  public warn(logLocation: string, message: string, ...args: unknown[]): void {
    this.diary.warn(`${this.PREFIX}:${logLocation}] ${message}`, ...args)
  }

  public error(logLocation: string, message: string | Error, ...args: unknown[]): void {
    this.diary.error(`${this.PREFIX}:${logLocation}] ${message}`, ...args)
  }

  public fatal(logLocation: string, message: string | Error, ...args: unknown[]): void {
    this.diary.fatal(`${this.PREFIX}:${logLocation}] ${message}`, ...args)
  }

  private onLogEvent(event: LogEvent): void {
    this.sinks.forEach((sink) => {
      sink.ingest(event)
    })
  }
}

export const logger = new Logger()

export interface ScopedLogger {
  debug: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  log: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string | Error, ...args: unknown[]) => void
  fatal: (message: string | Error, ...args: unknown[]) => void
}

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

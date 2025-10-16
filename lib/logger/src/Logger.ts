import { diary, enable, type Diary, type LogEvent } from 'diary'

import type LogSink from './LogSink'

export class Logger {
  readonly name = '@contentful/optimization'

  readonly #diary: Diary
  #sinks: LogSink[] = []

  constructor() {
    this.#diary = diary(this.name, this.onLogEvent.bind(this))
    enable(this.name)
  }

  public addSink(sink: LogSink): void {
    this.#sinks = [...this.#sinks.filter((existingSink) => existingSink.name !== sink.name), sink]
  }

  public removeSink(name: string): void {
    this.#sinks = this.#sinks.filter((sink) => sink.name !== name)
  }

  public removeSinks(): void {
    this.#sinks = []
  }

  public debug(message: string, ...args: unknown[]): void {
    this.#diary.debug(message, ...args)
  }

  public info(message: string, ...args: unknown[]): void {
    this.#diary.info(message, ...args)
  }

  public log(message: string, ...args: unknown[]): void {
    this.#diary.log(message, ...args)
  }

  public warn(message: string, ...args: unknown[]): void {
    this.#diary.warn(message, ...args)
  }

  public error(message: string | Error, ...args: unknown[]): void {
    this.#diary.error(message, ...args)
  }

  public fatal(message: string | Error, ...args: unknown[]): void {
    this.#diary.fatal(message, ...args)
  }

  private onLogEvent(event: LogEvent): void {
    this.#sinks.forEach((sink) => {
      sink.ingest(event)
    })
  }
}

export const logger = new Logger()

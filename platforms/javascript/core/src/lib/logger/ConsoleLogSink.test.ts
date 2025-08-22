/* eslint-disable no-console -- testing console */
import { ConsoleLogSink } from './ConsoleLogSink'
import type { LogEvent, LogLevels } from 'diary'

// Save the original console methods so we can restore after
const originalConsole = { ...console }

describe('ConsoleLogSink', () => {
  let spies: Record<string, ReturnType<typeof vi.fn>>
  const loggerName = '@contentful/optimization'

  beforeEach(() => {
    spies = {
      debug: vi.fn(),
      info: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    // Patch console methods
    Object.assign(console, spies)
  })

  afterEach(() => {
    // Restore original console methods
    Object.assign(console, originalConsole)
  })

  it('defaults to fatal verbosity', () => {
    const sink = new ConsoleLogSink()
    expect(sink.verbosity).toBe('fatal')
  })

  it('uses the provided verbosity', () => {
    const sink = new ConsoleLogSink('info')
    expect(sink.verbosity).toBe('info')
  })

  it('logs only if event level is equal or higher than verbosity', () => {
    const sink = new ConsoleLogSink('warn')

    // 'fatal' should log at 'warn' verbosity
    sink.ingest({
      name: loggerName,
      level: 'fatal',
      messages: ['fatal msg'],
      context: {},
      date: new Date(),
    })
    expect(console.error).toHaveBeenCalledWith('fatal msg')
    spies.error?.mockClear()

    // 'warn' should log at 'warn' verbosity
    sink.ingest({
      name: loggerName,
      level: 'warn',
      messages: ['warn msg'],
      context: {},
      date: new Date(),
    })
    expect(console.warn).toHaveBeenCalledWith('warn msg')
    spies.war?.mockClear()

    // 'info' should NOT log at 'warn' verbosity
    sink.ingest({
      name: loggerName,
      level: 'info',
      messages: ['info msg'],
      context: {},
      date: new Date(),
    })
    expect(console.info).not.toHaveBeenCalled()
  })

  it('logs with the correct console method for each level', () => {
    const sink = new ConsoleLogSink('log')
    const levels: LogLevels[] = ['debug', 'info', 'log', 'warn', 'error', 'fatal']

    levels.forEach((level) => {
      const msg = `${level} message`
      const event: LogEvent = {
        name: loggerName,
        level,
        messages: [msg],
        context: {},
        date: new Date(),
      }
      sink.ingest(event)
      if (level === 'fatal' || level === 'error') {
        expect(console.error).toHaveBeenLastCalledWith(msg)
      } else {
        expect(spies[level]).toHaveBeenLastCalledWith(msg)
      }
    })
  })

  it('passes all event messages as arguments to the console', () => {
    const sink = new ConsoleLogSink('debug')
    const messages = ['msg', 1, { a: true }]
    const event: LogEvent = {
      name: loggerName,
      level: 'info',
      messages,
      context: {},
      date: new Date(),
    }
    sink.ingest(event)
    expect(console.info).toHaveBeenCalledWith(...messages)
  })

  it('name property is "ConsoleLogSink"', () => {
    const sink = new ConsoleLogSink('log')
    expect(sink.name).toBe('ConsoleLogSink')
  })
})

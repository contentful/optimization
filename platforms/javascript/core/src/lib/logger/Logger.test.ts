import Logger, { type LogSink, type LogEvent } from './'

describe('Logger', () => {
  let logger: Logger
  let receivedEvents: LogEvent[]
  let testSink: LogSink

  beforeEach(() => {
    logger = new Logger()
    receivedEvents = []
    testSink = {
      name: 'testSink',
      ingest: (event: LogEvent) => {
        receivedEvents.push(event)
      },
    }
    logger.removeSinks()
  })

  it('initializes with the correct name', () => {
    expect(logger.name).toBe('@contentful/optimization')
  })

  it('adds and removes sinks correctly', () => {
    const ingest1 = vi.fn()
    const ingest2 = vi.fn()
    const sink1: LogSink = { name: 'sink1', ingest: ingest1 }
    const sink2: LogSink = { name: 'sink2', ingest: ingest2 }

    logger.addSink(sink1)
    logger.addSink(sink2)
    // Log to verify both sinks are active
    logger.info('Hello sinks')
    expect(ingest1).toHaveBeenCalled()
    expect(ingest2).toHaveBeenCalled()

    // Remove sink 1 and log again
    ingest1.mockClear()
    ingest2.mockClear()
    logger.removeSink('sink1')
    logger.info('After removal')
    expect(ingest1).not.toHaveBeenCalled()
    expect(ingest2).toHaveBeenCalled()

    // Remove all sinks
    ingest2.mockClear()
    logger.removeSinks()
    logger.info('No sinks should be called')
    expect(ingest2).not.toHaveBeenCalled()
  })

  it('replaces a sink with the same name', () => {
    const ingest1 = vi.fn()
    const ingest2 = vi.fn()
    const sink1: LogSink = { name: 'mySink', ingest: ingest1 }
    const sink2: LogSink = { name: 'mySink', ingest: ingest2 }

    logger.addSink(sink1)
    logger.addSink(sink2)
    logger.info('Test message')

    expect(ingest1).not.toHaveBeenCalled()
    expect(ingest2).toHaveBeenCalled()
  })

  it('forwards debug/info/log/warn/error/fatal messages to sinks as events', () => {
    logger.addSink(testSink)

    logger.debug('Debug test', 1, 2)
    logger.info('Info test', { foo: true })
    logger.log('Log test')
    logger.warn('Warn test', 'warnArg')
    logger.error('Error test', new Error('fail'))
    logger.fatal('Fatal test', 123)

    // Should have received one event per call
    expect(receivedEvents.length).toBe(6)
    const messages = receivedEvents.map((ev) => ev.messages[0])
    expect(messages).toEqual([
      'Debug test',
      'Info test',
      'Log test',
      'Warn test',
      'Error test',
      'Fatal test',
    ])

    const levels = receivedEvents.map((ev) => ev.level)
    expect(levels).toEqual(['debug', 'info', 'log', 'warn', 'error', 'fatal'])
  })

  it('passes all additional log arguments in the event messages', () => {
    logger.addSink(testSink)
    logger.info('multiple', 1, 2, 3)
    expect(receivedEvents[0]?.messages).toEqual(['multiple', 1, 2, 3])
  })

  it('can add, remove, and re-add the same sink', () => {
    logger.addSink(testSink)
    logger.info('one')
    expect(receivedEvents.length).toBe(1)

    logger.removeSink('testSink')
    logger.info('should not be delivered')
    expect(receivedEvents.length).toBe(1)

    logger.addSink(testSink)
    logger.info('two')
    expect(receivedEvents.length).toBe(2)
  })
})

import Logger, { type LogEvent, type LogSink } from '.'

const TEST_LOCATION = 'LoggerTest'

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
    logger.info(TEST_LOCATION, 'Hello sinks')
    expect(ingest1).toHaveBeenCalled()
    expect(ingest2).toHaveBeenCalled()

    // Remove sink 1 and log again
    ingest1.mockClear()
    ingest2.mockClear()
    logger.removeSink('sink1')
    logger.info(TEST_LOCATION, 'After removal')
    expect(ingest1).not.toHaveBeenCalled()
    expect(ingest2).toHaveBeenCalled()

    // Remove all sinks
    ingest2.mockClear()
    logger.removeSinks()
    logger.info(TEST_LOCATION, 'No sinks should be called')
    expect(ingest2).not.toHaveBeenCalled()
  })

  it('replaces a sink with the same name', () => {
    const ingest1 = vi.fn()
    const ingest2 = vi.fn()
    const sink1: LogSink = { name: 'mySink', ingest: ingest1 }
    const sink2: LogSink = { name: 'mySink', ingest: ingest2 }

    logger.addSink(sink1)
    logger.addSink(sink2)
    logger.info(TEST_LOCATION, 'Test message')

    expect(ingest1).not.toHaveBeenCalled()
    expect(ingest2).toHaveBeenCalled()
  })

  it('forwards debug/info/log/warn/error/fatal messages to sinks as events', () => {
    logger.addSink(testSink)

    logger.debug(TEST_LOCATION, 'Debug test', 1, 2)
    logger.info(TEST_LOCATION, 'Info test', { foo: true })
    logger.log(TEST_LOCATION, 'Log test')
    logger.warn(TEST_LOCATION, 'Warn test', 'warnArg')
    logger.error(TEST_LOCATION, new Error('fail'))
    logger.fatal(TEST_LOCATION, new Error('fatal fail'))

    // Should have received one event per call
    expect(receivedEvents.length).toBe(6)

    const levels = receivedEvents.map((ev) => ev.level)
    expect(levels).toEqual(['debug', 'info', 'log', 'warn', 'error', 'fatal'])
  })

  it('passes all additional log arguments in the event messages', () => {
    logger.addSink(testSink)
    logger.info(TEST_LOCATION, 'multiple', 1, 2, 3)
    expect(receivedEvents[0]?.messages.length).toBeGreaterThanOrEqual(1)
  })

  it('can add, remove, and re-add the same sink', () => {
    logger.addSink(testSink)
    logger.info(TEST_LOCATION, 'one')
    expect(receivedEvents.length).toBe(1)

    logger.removeSink('testSink')
    logger.info(TEST_LOCATION, 'should not be delivered')
    expect(receivedEvents.length).toBe(1)

    logger.addSink(testSink)
    logger.info(TEST_LOCATION, 'two')
    expect(receivedEvents.length).toBe(2)
  })
})

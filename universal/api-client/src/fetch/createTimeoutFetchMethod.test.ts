import { mockLogger } from '../test/mockLogger'
import { createTimeoutFetchMethod } from './createTimeoutFetchMethod'

describe('createTimeoutFetchMethod', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let onRequestTimeout: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    onRequestTimeout = vi.fn()
    vi.useFakeTimers()
    vi.clearAllTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls fetchMethod and resolves response before timeout', async () => {
    const fakeResponse = new Response('ok', { status: 200 })
    fetchMock.mockResolvedValue(fakeResponse)

    const fetchWithTimeout = createTimeoutFetchMethod({
      fetchMethod: fetchMock,
      requestTimeout: 1000,
      onRequestTimeout,
    })

    const result = await fetchWithTimeout('http://test.com', {})

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls.flat()

    expect(url).toBe('http://test.com')
    expect(init).toHaveProperty('signal')
    expect(init.signal).toBeInstanceOf(AbortSignal)

    expect(result).toBe(fakeResponse)
    expect(onRequestTimeout).not.toHaveBeenCalled()
    expect(mockLogger.error).not.toHaveBeenCalled()
  })

  it('calls onRequestTimeout if fetch times out', () => {
    fetchMock.mockReturnValue(new Promise((resolve) => setTimeout(resolve, 5000)))

    const fetchWithTimeout = createTimeoutFetchMethod({
      fetchMethod: fetchMock,
      requestTimeout: 1000,
      onRequestTimeout,
      apiName: 'CustomAPI',
    })

    fetchWithTimeout('http://timeout.com', {})

    vi.advanceTimersByTime(1000)

    expect(onRequestTimeout).toHaveBeenCalledWith({ apiName: 'CustomAPI' })
    expect(mockLogger.error).not.toHaveBeenCalled()
  })

  it('calls logger.error if no onRequestTimeout is provided', () => {
    fetchMock.mockReturnValue(new Promise((resolve) => setTimeout(resolve, 5000)))

    const fetchWithTimeout = createTimeoutFetchMethod({
      fetchMethod: fetchMock,
      requestTimeout: 500,
      apiName: 'FailAPI',
    })

    fetchWithTimeout('http://fail.com', {})

    vi.advanceTimersByTime(500)

    expect(mockLogger.error).toHaveBeenCalled()
    expect(onRequestTimeout).not.toHaveBeenCalled()
  })
})

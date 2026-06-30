import { mockLogger } from 'mocks'
import { createTimeoutFetchMethod } from './createTimeoutFetchMethod'

describe('createTimeoutFetchMethod', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof rs.fn>
  let onRequestTimeout: ReturnType<typeof rs.fn>

  beforeEach(() => {
    fetchMock = rs.fn()
    onRequestTimeout = rs.fn()
    rs.useFakeTimers()
    rs.clearAllTimers()
    rs.clearAllMocks()
  })

  afterEach(() => {
    rs.stubGlobal('fetch', originalFetch)
    rs.useRealTimers()
  })

  it('uses global fetch when fetchMethod is omitted', async () => {
    const fakeResponse = new Response('ok', { status: 200 })
    fetchMock.mockResolvedValue(fakeResponse)
    rs.stubGlobal('fetch', fetchMock)

    const fetchWithTimeout = createTimeoutFetchMethod({
      requestTimeout: 1000,
      onRequestTimeout,
    })

    const result = await fetchWithTimeout('http://test.com', {})

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result).toBe(fakeResponse)
  })

  it('throws a configuration error when no fetch method is available', () => {
    rs.stubGlobal('fetch', undefined)

    expect(() => createTimeoutFetchMethod()).toThrow(
      'No fetch implementation available. Provide a fetchMethod.',
    )
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

    rs.advanceTimersByTime(1000)

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

    rs.advanceTimersByTime(500)

    expect(mockLogger.error).toHaveBeenCalled()
    expect(onRequestTimeout).not.toHaveBeenCalled()
  })
})

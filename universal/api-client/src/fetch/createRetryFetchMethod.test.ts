import { mockLogger } from 'mocks'
import { createRetryFetchMethod } from './createRetryFetchMethod'

const TEST_URL = 'https://example.com/endpoint'

describe('createRetryFetchMethod', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let onFailedAttempt: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    onFailedAttempt = vi.fn()
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls fetchMethod and returns the response when successful', async () => {
    const fakeResponse = new Response('ok', { status: 200 })
    fetchMock.mockResolvedValue(fakeResponse)

    const fetchWithRetry = createRetryFetchMethod({ fetchMethod: fetchMock })

    const result = await fetchWithRetry(TEST_URL, {})

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result).toBe(fakeResponse)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'ApiClient:Retry',
      `Response from "${TEST_URL}":`,
      fakeResponse,
    )
  })

  it('retries if the fetch returns a 503 status', async () => {
    const firstResponse = new Response('Service unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    })
    const secondResponse = new Response('ok', { status: 200 })
    fetchMock.mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(secondResponse)

    const fetchWithRetry = createRetryFetchMethod({
      fetchMethod: fetchMock,
      onFailedAttempt,
      retries: 1,
      intervalTimeout: 50, // short retry interval for test
    })

    const promise = fetchWithRetry(TEST_URL, {})

    // Advance timers for the retry interval
    await vi.advanceTimersByTimeAsync(60)

    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onFailedAttempt).toHaveBeenCalled()
    expect(result).toBe(secondResponse)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'ApiClient:Retry',
      `Response from "${TEST_URL}":`,
      secondResponse,
    )
  })

  it('throws and does not retry if fetch returns a non-503 error', async () => {
    const errorResponse = new Response('Error', {
      status: 400,
      statusText: 'Bad Request',
      headers: { traceparent: 'abc-123' },
    })
    fetchMock.mockResolvedValue(errorResponse)

    const fetchWithRetry = createRetryFetchMethod({
      fetchMethod: fetchMock,
      onFailedAttempt,
      retries: 2,
      intervalTimeout: 50,
    })

    await expect(fetchWithRetry(TEST_URL, {})).rejects.toThrow(/may not be retried/)
    expect(mockLogger.error).toHaveBeenCalledWith(
      'ApiClient:Retry',
      'Request failed with non-OK status:',
      expect.objectContaining({
        message: `Request to "${TEST_URL}" failed with status: [400] Bad Request - traceparent: abc-123`,
      }),
    )
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(onFailedAttempt).not.toHaveBeenCalled()
    expect(mockLogger.debug).not.toHaveBeenCalled()
  })

  it('calls logger.debug with log location', async () => {
    const fakeResponse = new Response('ok', { status: 200 })
    fetchMock.mockResolvedValue(fakeResponse)

    const fetchWithRetry = createRetryFetchMethod({
      fetchMethod: fetchMock,
      apiName: 'MyAPI',
    })

    const result = await fetchWithRetry(TEST_URL, {})

    expect(result).toBe(fakeResponse)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'ApiClient:Retry',
      `Response from "${TEST_URL}":`,
      fakeResponse,
    )
  })

  it('retries the configured number of times for 503 and then fails', async () => {
    fetchMock.mockResolvedValue(
      new Response('fail', { status: 503, statusText: 'Service Unavailable' }),
    )
    const fetchWithRetry = createRetryFetchMethod({
      fetchMethod: fetchMock,
      onFailedAttempt,
      retries: 2,
      intervalTimeout: 50,
    })

    const promise = fetchWithRetry(TEST_URL, {})

    // Attach the rejection handler BEFORE running timers
    const rejection = expect(promise).rejects.toThrow(
      `API request to "${TEST_URL}" failed with status: "[503] Service Unavailable".`,
    )

    await vi.advanceTimersByTimeAsync(200)

    await rejection

    // 1 initial + 2 retries = 3 total attempts
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(onFailedAttempt).toHaveBeenCalledTimes(3)
  })

  it('calls onFailedAttempt with apiName in options', async () => {
    const firstResponse = new Response('fail', { status: 503, statusText: 'Service Unavailable' })
    const secondResponse = new Response('ok', { status: 200 })
    fetchMock.mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(secondResponse)

    const fetchWithRetry = createRetryFetchMethod({
      fetchMethod: fetchMock,
      onFailedAttempt,
      apiName: 'CustomAPI',
      retries: 1,
      intervalTimeout: 50,
    })

    const promise = fetchWithRetry(TEST_URL, {})
    await vi.advanceTimersByTimeAsync(60)
    await promise

    expect(onFailedAttempt).toHaveBeenCalledWith(expect.objectContaining({ apiName: 'CustomAPI' }))
  })

  it('aborts and throws a generic error if fetchMethod throws an unknown error', async () => {
    fetchMock.mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- necessary for the condition
      throw 'something weird'
    })
    const fetchWithRetry = createRetryFetchMethod({
      fetchMethod: fetchMock,
      onFailedAttempt,
      retries: 0,
      intervalTimeout: 10,
    })
    await expect(fetchWithRetry(TEST_URL, {})).rejects.toThrow(/may not be retried/)
    expect(mockLogger.error).toHaveBeenCalledWith(
      'ApiClient:Retry',
      `Request to "${TEST_URL}" failed:`,
      'something weird',
    )
    expect(onFailedAttempt).not.toHaveBeenCalled()
    expect(mockLogger.debug).not.toHaveBeenCalled()
  })

  it('aborts and throws if fetchMethod throws an Error instance (non-503)', async () => {
    const error = new Error('plain failure')
    fetchMock.mockImplementation(() => {
      throw error
    })
    const fetchWithRetry = createRetryFetchMethod({
      fetchMethod: fetchMock,
      onFailedAttempt,
      retries: 0,
      intervalTimeout: 10,
    })
    await expect(fetchWithRetry(TEST_URL, {})).rejects.toThrow(/may not be retried/)
    expect(mockLogger.error).toHaveBeenCalledWith(
      'ApiClient:Retry',
      `Request to "${TEST_URL}" failed:`,
      error,
    )
    expect(onFailedAttempt).not.toHaveBeenCalled()
    expect(mockLogger.debug).not.toHaveBeenCalled()
  })

  it('waits intervalTimeout between retries', async () => {
    const firstResponse = new Response('fail', { status: 503, statusText: 'Service Unavailable' })
    const secondResponse = new Response('ok', { status: 200 })
    fetchMock.mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(secondResponse)

    const fetchWithRetry = createRetryFetchMethod({
      fetchMethod: fetchMock,
      retries: 1,
      intervalTimeout: 1234,
    })

    let resolved = false
    const promise = fetchWithRetry(TEST_URL, {}).then(() => {
      resolved = true
    })

    // First attempt is immediate, so after 0ms: 1st call made
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(resolved).toBe(false)

    // Advance time less than intervalTimeout; second attempt shouldn't happen yet
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(resolved).toBe(false)

    // Advance time to cover the retry interval; second attempt and resolution happen
    await vi.advanceTimersByTimeAsync(234)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await promise
    expect(resolved).toBe(true)
  })
})

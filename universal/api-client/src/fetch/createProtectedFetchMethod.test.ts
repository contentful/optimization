import { createLoggerMock } from 'mocks'
import type { MockInstance } from 'vitest'
import type { FetchMethod } from './Fetch'
import {
  createProtectedFetchMethod,
  type ProtectedFetchMethodOptions,
} from './createProtectedFetchMethod'
import * as createRetryFetchMethodModule from './createRetryFetchMethod'
import * as createTimeoutFetchMethodModule from './createTimeoutFetchMethod'

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
}))

vi.mock('logger', () => createLoggerMock(mockLogger))

vi.mock('./createRetryFetchMethod')
vi.mock('./createTimeoutFetchMethod')

describe('createProtectedFetchMethod', () => {
  const timeoutFetchMethod = vi.fn()
  const retryFetchMethod = vi.fn()
  const options: ProtectedFetchMethodOptions = {
    intervalTimeout: 100,
    requestTimeout: 2000,
    retries: 2,
  }

  let createTimeoutFetchMethodSpy: MockInstance<
    (options?: createTimeoutFetchMethodModule.TimeoutFetchMethodOptions) => FetchMethod
  >
  let createRetryFetchMethodSpy: MockInstance<
    (
      options: createRetryFetchMethodModule.RetryFetchMethodOptions & { fetchMethod: FetchMethod },
    ) => FetchMethod
  >

  beforeEach(() => {
    vi.clearAllMocks()
    createTimeoutFetchMethodSpy = vi.spyOn(
      createTimeoutFetchMethodModule,
      'createTimeoutFetchMethod',
    )
    createRetryFetchMethodSpy = vi.spyOn(createRetryFetchMethodModule, 'createRetryFetchMethod')

    createTimeoutFetchMethodSpy.mockReturnValue(timeoutFetchMethod)
    createRetryFetchMethodSpy.mockReturnValue(retryFetchMethod)
  })

  it('composes fetch methods and returns the retryFetchMethod', () => {
    const result = createProtectedFetchMethod(options)
    expect(createTimeoutFetchMethodSpy).toHaveBeenCalledWith(options)
    expect(createRetryFetchMethodSpy).toHaveBeenCalledWith({
      ...options,
      fetchMethod: timeoutFetchMethod,
    })
    expect(result).toBe(retryFetchMethod)
  })

  it('logs and throws on AbortError', () => {
    const abortError = Object.assign(new Error('Aborted!'), { name: 'AbortError' })
    createTimeoutFetchMethodSpy.mockImplementation(() => {
      throw abortError
    })

    expect(() => createProtectedFetchMethod(options)).toThrow(abortError)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ApiClient:Fetch',
      'Request aborted due to network issues. This request may not be retried.',
    )
    expect(mockLogger.error).not.toHaveBeenCalled()
  })

  it('logs and throws on generic error', () => {
    const someError = Object.assign(new Error('Something went wrong'), { name: 'NetworkError' })
    createTimeoutFetchMethodSpy.mockImplementation(() => {
      throw someError
    })

    expect(() => createProtectedFetchMethod(options)).toThrow(someError)
    expect(mockLogger.error).toHaveBeenCalledWith(
      'ApiClient:Fetch',
      'Request failed with error: [NetworkError] Something went wrong',
    )
    expect(mockLogger.warn).not.toHaveBeenCalled()
  })

  it('rethrows non-Error errors without logging', () => {
    const nonError = 'random string'
    createTimeoutFetchMethodSpy.mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- necessary for the condition
      throw nonError
    })

    expect(() => createProtectedFetchMethod(options)).toThrow(nonError)
    expect(mockLogger.error).not.toHaveBeenCalled()
    expect(mockLogger.warn).not.toHaveBeenCalled()
  })
})

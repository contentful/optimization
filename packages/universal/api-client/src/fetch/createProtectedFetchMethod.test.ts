import { mockLogger } from 'mocks'
import {
  createProtectedFetchMethod,
  type ProtectedFetchMethodOptions,
} from './createProtectedFetchMethod'
import * as createRetryFetchMethodModule from './createRetryFetchMethod'
import * as createTimeoutFetchMethodModule from './createTimeoutFetchMethod'

rs.mock('./createRetryFetchMethod', { mock: true })
rs.mock('./createTimeoutFetchMethod', { mock: true })

describe('createProtectedFetchMethod', () => {
  const timeoutFetchMethod = rs.fn()
  const retryFetchMethod = rs.fn()
  const options: ProtectedFetchMethodOptions = {
    intervalTimeout: 100,
    requestTimeout: 2000,
    retries: 2,
  }

  let createTimeoutFetchMethodSpy: ReturnType<typeof rs.spyOn>
  let createRetryFetchMethodSpy: ReturnType<typeof rs.spyOn>

  beforeEach(() => {
    rs.clearAllMocks()
    createTimeoutFetchMethodSpy = rs.spyOn(
      createTimeoutFetchMethodModule,
      'createTimeoutFetchMethod',
    )
    createRetryFetchMethodSpy = rs.spyOn(createRetryFetchMethodModule, 'createRetryFetchMethod')

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
    expect(mockLogger.error).toHaveBeenCalledWith('ApiClient:Fetch', 'Request failed:', someError)
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

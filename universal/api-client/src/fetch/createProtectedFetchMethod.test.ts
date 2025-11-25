import { logger } from 'logger'
import type { MockInstance } from 'vitest'
import type { FetchMethod } from './Fetch'
import {
  createProtectedFetchMethod,
  type ProtectedFetchMethodOptions,
} from './createProtectedFetchMethod'
import * as createRetryFetchMethodModule from './createRetryFetchMethod'
import * as createTimeoutFetchMethodModule from './createTimeoutFetchMethod'

vi.mock('logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

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
  let warnSpy: MockInstance<(msg: string) => void>
  let errorSpy: MockInstance<(msg: string) => void>

  beforeEach(() => {
    vi.clearAllMocks()
    createTimeoutFetchMethodSpy = vi.spyOn(
      createTimeoutFetchMethodModule,
      'createTimeoutFetchMethod',
    )
    createRetryFetchMethodSpy = vi.spyOn(createRetryFetchMethodModule, 'createRetryFetchMethod')
    warnSpy = vi.spyOn(logger, 'warn')
    errorSpy = vi.spyOn(logger, 'error')

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
    expect(warnSpy).toHaveBeenCalledWith(
      'The request aborted due to network issues. This request may not be retried.',
    )
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('logs and throws on generic error', () => {
    const someError = Object.assign(new Error('Something went wrong'), { name: 'NetworkError' })
    createTimeoutFetchMethodSpy.mockImplementation(() => {
      throw someError
    })

    expect(() => createProtectedFetchMethod(options)).toThrow(someError)
    expect(errorSpy).toHaveBeenCalledWith(
      'The request failed with error: [NetworkError] Something went wrong',
    )
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('rethrows non-Error errors without logging', () => {
    const nonError = 'random string'
    createTimeoutFetchMethodSpy.mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- necessary for the condition
      throw nonError
    })

    expect(() => createProtectedFetchMethod(options)).toThrow(nonError)
    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })
})

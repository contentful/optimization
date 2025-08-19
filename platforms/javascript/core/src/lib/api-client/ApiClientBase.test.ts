import { logger } from '../logger'
import ApiClientBase, { type ApiConfig } from './ApiClientBase'
import Fetch from './fetch'

class TestApiClient extends ApiClientBase {
  protected readonly baseUrl = 'https://example.com'
  // Expose a public hook to call the protected method from tests
  public triggerLogRequestError(error: unknown, requestName: string): void {
    // call the protected method
    this.logRequestError(error, { requestName })
  }
}

const mockFetchMethod = vi.fn()

describe('ApiClientBase', () => {
  const name = 'MyAPI'
  const fetchOptions: ApiConfig['fetchOptions'] = {}
  let config: ApiConfig

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(Fetch, 'create').mockReturnValue(mockFetchMethod)
    config = { clientId: 'testId', fetchOptions }
  })

  it('calls createProtectedFetchMethod with correct merged options', () => {
    const client = new TestApiClient(name, config)
    expect(Fetch.create).toHaveBeenCalledTimes(1)
    expect(Fetch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ...fetchOptions,
        apiName: name,
      }),
    )
    expect(client.fetch).toBe(mockFetchMethod)
  })

  it('assigns the fetch property from createProtectedFetchMethod', () => {
    const client = new TestApiClient(name, config)
    expect(client.fetch).toBe(mockFetchMethod)
  })

  describe('logRequestError', () => {
    it('logs a warning for AbortError', () => {
      const client = new TestApiClient(name, config)
      const warnSpy = vi.spyOn(logger, 'warn')
      const errorSpy = vi.spyOn(logger, 'error')

      const err = new Error('Request aborted')
      err.name = 'AbortError'
      const requestName = 'getEntries'

      client.triggerLogRequestError(err, requestName)

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith(
        `${name} API ${requestName} request aborted due to network issues. This request may not be retried.`,
      )
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('logs an error for non-abort Errors', () => {
      const client = new TestApiClient(name, config)
      const warnSpy = vi.spyOn(logger, 'warn')
      const errorSpy = vi.spyOn(logger, 'error')

      const err = new Error('Boom')
      // err.name remains "Error"
      const requestName = 'createEntry'

      client.triggerLogRequestError(err, requestName)

      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy).toHaveBeenCalledWith(
        `${name} API ${requestName} request failed with error: [${err.name}] ${err.message}`,
      )
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('does nothing for non-Error values', () => {
      const client = new TestApiClient(name, config)
      const warnSpy = vi.spyOn(logger, 'warn')
      const errorSpy = vi.spyOn(logger, 'error')

      // Pass something that is not an instance of Error
      client.triggerLogRequestError('not-an-error', 'deleteAsset')

      expect(warnSpy).not.toHaveBeenCalled()
      expect(errorSpy).not.toHaveBeenCalled()
    })
  })
})

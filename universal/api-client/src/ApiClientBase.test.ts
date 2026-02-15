import { mockLogger } from 'mocks'
import ApiClientBase, { type ApiConfig } from './ApiClientBase'
import Fetch from './fetch'

class TestApiClient extends ApiClientBase {
  protected readonly baseUrl = 'https://example.com'

  triggerLogRequestError(error: unknown, requestName: string): void {
    this.logRequestError(error, { requestName })
  }

  async fetchSomething(): Promise<void> {
    await this.fetch('https://ecample.com', {})
  }
}

const mockFetchMethod = rs.fn()

describe('ApiClientBase', () => {
  const name = 'MyAPI'
  const fetchOptions: ApiConfig['fetchOptions'] = {}
  let config: ApiConfig

  beforeEach(() => {
    rs.spyOn(Fetch, 'create').mockReturnValue(mockFetchMethod)
    config = { clientId: 'testId', fetchOptions }
  })

  afterEach(() => {
    rs.restoreAllMocks()
  })

  it('creates fetch method with correct merged options', () => {
    // eslint-disable-next-line no-new -- testing
    new TestApiClient(name, config)
    expect(Fetch.create).toHaveBeenCalledTimes(1)
    expect(Fetch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ...fetchOptions,
        apiName: name,
      }),
    )
  })

  describe('logRequestError', () => {
    it('logs a warning for AbortError', () => {
      const client = new TestApiClient(name, config)

      const err = new Error('Request aborted')
      err.name = 'AbortError'
      const requestName = 'getEntries'

      client.triggerLogRequestError(err, requestName)

      expect(mockLogger.warn).toHaveBeenCalledTimes(1)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ApiClient',
        `[${name}] "${requestName}" request aborted due to network issues. This request may not be retried.`,
      )
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    it('logs an error for non-abort Errors', () => {
      const client = new TestApiClient(name, config)

      const err = new Error('Boom')
      // err.name remains "Error"
      const requestName = 'createEntry'

      client.triggerLogRequestError(err, requestName)

      expect(mockLogger.error).toHaveBeenCalledTimes(1)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'ApiClient',
        `[${name}] "${requestName}" request failed:`,
        err,
      )
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('does nothing for non-Error values', () => {
      const client = new TestApiClient(name, config)

      // Pass something that is not an instance of Error
      client.triggerLogRequestError('not-an-error', 'deleteAsset')

      expect(mockLogger.warn).not.toHaveBeenCalled()
      expect(mockLogger.error).not.toHaveBeenCalled()
    })
  })
})

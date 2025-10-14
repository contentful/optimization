import { logger } from '../logger'
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

const mockFetchMethod = vi.fn()

describe('ApiClientBase', () => {
  const name = 'MyAPI'
  const fetchOptions: ApiConfig['fetchOptions'] = {}
  let config: ApiConfig

  beforeEach(() => {
    vi.spyOn(Fetch, 'create').mockReturnValue(mockFetchMethod)
    config = { clientId: 'testId', fetchOptions }
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

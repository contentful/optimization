import ApiClientBase, { type ApiConfig } from './ApiClientBase'
import Fetch from './fetch'

class TestApiClient extends ApiClientBase {}

const mockFetchMethod = vi.fn()

describe('ApiClientBase', () => {
  const name = 'MyAPI'
  const fetchOptions: ApiConfig['fetchOptions'] = {}
  let config: ApiConfig

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(Fetch, 'create').mockReturnValue(mockFetchMethod)
    config = { fetchOptions }
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
})

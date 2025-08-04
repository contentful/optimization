import Fetch, { type FetchMethod, type ProtectedFetchMethodOptions } from './fetch'

export interface ApiConfig {
  fetchOptions?: Omit<ProtectedFetchMethodOptions, 'apiName'>
}

export default abstract class ApiClientBase {
  readonly fetch: FetchMethod

  constructor(name: string, config?: ApiConfig) {
    this.fetch = Fetch.create({ ...(config?.fetchOptions ?? {}), apiName: name })
  }
}

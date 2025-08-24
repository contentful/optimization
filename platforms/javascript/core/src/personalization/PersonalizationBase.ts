import type ApiClient from '../lib/api-client'
import mapper from './Mapper'

abstract class PersonalizationBase {
  protected readonly api: ApiClient
  readonly mapper: typeof mapper

  constructor(api: ApiClient) {
    this.mapper = mapper
    this.api = api
  }

  abstract page(payload: object): Promise<void> | void
}

export default PersonalizationBase

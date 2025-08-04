// TODO: Real, non-demo implementation (stateless & stateful)
import type ApiClient from '../lib/api-client'
import mapper from './Mapper'

export default class Personalization {
  readonly api: ApiClient
  readonly mapper: typeof mapper

  constructor(api: ApiClient) {
    this.mapper = mapper
    this.api = api
  }

  async page(payload: object): Promise<void> {
    await this.api.experience.fetch('/page', { method: 'POST', body: JSON.stringify(payload) })
  }
}

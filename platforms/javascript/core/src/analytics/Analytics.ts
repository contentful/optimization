// TODO: Real, non-demo implementation (stateless & stateful)
import type ApiClient from '../lib/api-client'

export default class Analytics {
  readonly api: ApiClient

  constructor(api: ApiClient) {
    this.api = api
  }

  async track(payload: object): Promise<void> {
    await this.api.insights.fetch('/track', { method: 'POST', body: JSON.stringify(payload) })
  }
}

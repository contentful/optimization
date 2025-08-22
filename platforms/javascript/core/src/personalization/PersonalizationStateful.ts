import type ApiClient from '../lib/api-client'
import PersonalizationBase from './PersonalizationBase'

class PersonalizationStateful extends PersonalizationBase {
  constructor(api: ApiClient) {
    super(api)

    void 0 // TODO: Get and subscribe to state
  }

  async page(payload: object): Promise<void> {
    void (this.api, payload)
    await Promise.resolve() // TODO: Logic
  }
}

export default PersonalizationStateful

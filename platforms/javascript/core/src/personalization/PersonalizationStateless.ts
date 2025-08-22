import PersonalizationBase from './PersonalizationBase'

class PersonalizationStateless extends PersonalizationBase {
  async page(payload: object): Promise<void> {
    void (this.api, payload)
    await Promise.resolve() // TODO: Logic
  }
}

export default PersonalizationStateless

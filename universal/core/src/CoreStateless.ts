import { AnalyticsStateless } from './analytics'
import CoreBase, { type CoreConfig } from './CoreBase'
import { PersonalizationStateless } from './personalization'

class CoreStateless extends CoreBase {
  readonly analytics: AnalyticsStateless
  readonly personalization: PersonalizationStateless

  constructor(config: CoreConfig) {
    super(config)

    this.analytics = new AnalyticsStateless(this.api, this.eventBuilder)
    this.personalization = new PersonalizationStateless(this.api, this.eventBuilder)
  }
}

export default CoreStateless

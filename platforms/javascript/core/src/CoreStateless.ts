import { AnalyticsStateless } from './analytics'
import CoreBase, { type CoreConfig } from './CoreBase'

class CoreStateless extends CoreBase {
  readonly analytics: AnalyticsStateless

  constructor(config: CoreConfig) {
    super(config)

    this.analytics = new AnalyticsStateless(this.api, this.eventBuilder)
  }
}

export default CoreStateless

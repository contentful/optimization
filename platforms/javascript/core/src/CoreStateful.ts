import { AnalyticsStateful } from './analytics'
import CoreBase, { type CoreConfig } from './CoreBase'

class CoreStateful extends CoreBase {
  readonly analytics: AnalyticsStateful

  constructor(config: CoreConfig) {
    super(config)

    const { defaults } = config

    this.analytics = new AnalyticsStateful(this.api, this.eventBuilder, defaults?.analytics)
  }
}

export default CoreStateful

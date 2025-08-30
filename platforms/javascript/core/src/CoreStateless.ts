import { AnalyticsStateless } from './analytics'
import CoreBase, { type CoreConfig } from './CoreBase'
import type { EventBuilder } from './lib/builders'

class CoreStateless extends CoreBase {
  readonly analytics: AnalyticsStateless

  constructor(config: CoreConfig, builder: EventBuilder) {
    super(config, builder)

    this.analytics = new AnalyticsStateless(this.api, builder)
  }
}

export default CoreStateless

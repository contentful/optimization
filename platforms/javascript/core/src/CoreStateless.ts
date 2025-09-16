import { Analytics } from './analytics'
import { EventHandlerStateless } from './analytics/EventHandler'
import CoreBase, { type CoreConfig } from './CoreBase'
import type { EventBuilder } from './lib/api-client/builders'

class CoreStateless extends CoreBase {
  readonly analytics: Analytics

  constructor(config: CoreConfig, builder: EventBuilder) {
    super(config, builder)

    this.analytics = new Analytics(this.api, builder, new EventHandlerStateless(this.api))
  }
}

export default CoreStateless

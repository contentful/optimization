import { AnalyticsStateless } from './analytics'
import { FlagsStateless } from './flags'
import { PersonalizationStateless } from './personalization'
import CoreBase, { type CoreConfig, signals } from './CoreBase'

class CoreStateless extends CoreBase {
  readonly analytics: AnalyticsStateless
  readonly flags: FlagsStateless
  readonly personalization: PersonalizationStateless

  constructor(config: CoreConfig) {
    super(config)

    this.analytics = new AnalyticsStateless(signals, this.api)
    this.flags = new FlagsStateless(signals)
    this.personalization = new PersonalizationStateless(signals, this.api)
  }
}

export default CoreStateless

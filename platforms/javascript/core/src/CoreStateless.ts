import { AnalyticsStateless } from './analytics'
import { AudienceStateless } from './audience'
import { ExperimentsStateless } from './experiments'
import { FlagsStateless } from './flags'
import { PersonalizationStateless } from './personalization'
import CoreBase, { type CoreConfig } from './CoreBase'

class CoreStateless extends CoreBase {
  readonly analytics: AnalyticsStateless
  readonly audience: AudienceStateless
  readonly experiments: ExperimentsStateless
  readonly flags: FlagsStateless
  readonly personalization: PersonalizationStateless

  constructor(config: CoreConfig) {
    super(config)

    this.analytics = new AnalyticsStateless(this.api)
    this.audience = new AudienceStateless()
    this.experiments = new ExperimentsStateless()
    this.flags = new FlagsStateless()
    this.personalization = new PersonalizationStateless(this.api)
  }
}

export default CoreStateless

import { AnalyticsStateful } from './analytics'
import { AudienceStateful } from './audience'
import { ExperimentsStateful } from './experiments'
import { FlagsStateful } from './flags'
import { PersonalizationStateful } from './personalization'
import CoreBase, { type CoreConfig } from './CoreBase'

class CoreStateful extends CoreBase {
  readonly analytics: AnalyticsStateful
  readonly audience: AudienceStateful
  readonly experiments: ExperimentsStateful
  readonly flags: FlagsStateful
  readonly personalization: PersonalizationStateful

  constructor(config: CoreConfig) {
    super(config)

    this.analytics = new AnalyticsStateful(this.api)
    this.audience = new AudienceStateful()
    this.experiments = new ExperimentsStateful()
    this.flags = new FlagsStateful()
    this.personalization = new PersonalizationStateful(this.api)
  }
}

export default CoreStateful

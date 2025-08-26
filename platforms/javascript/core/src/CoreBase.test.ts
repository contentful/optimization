import { signal } from '@preact/signals-core'
import { AnalyticsStateless } from './analytics'
import { FlagsStateless } from './flags'
import { PersonalizationStateless } from './personalization'
import CoreBase, { type Signals } from './CoreBase'
import ApiClient from './lib/api-client'
import type { ExperienceArrayType } from './lib/api-client/experience/dto/experience'
import type { ChangeArrayType } from './lib/api-client/experience/dto/change'
import type { ProfileType } from './lib/api-client/experience/dto/profile'

const api = new ApiClient({ clientId: 'client-id' })

const testSignals: Signals = {
  audiences: signal<string[] | undefined>(),
  experiences: signal<ExperienceArrayType | undefined>(),
  experiments: signal<ExperienceArrayType | undefined>(),
  flags: signal<ChangeArrayType | undefined>(),
  personalizations: signal<ExperienceArrayType | undefined>(),
  profile: signal<ProfileType | undefined>(),
}

class TestCore extends CoreBase {
  analytics = new AnalyticsStateless(testSignals, api)
  flags = new FlagsStateless(testSignals)
  personalization = new PersonalizationStateless(testSignals, api)
}

const config = { name: 'Test', clientId: 'testId' }

describe('CoreBase', () => {
  it('accepts name option', () => {
    const core = new TestCore(config)

    expect(core.name).toEqual(config.name)
  })
})

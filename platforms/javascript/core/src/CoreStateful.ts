import type { Flags } from './lib/api-client/experience/dto/change'
import type { ExperienceArrayType } from './lib/api-client/experience/dto/experience'
import type { ProfileType } from './lib/api-client/experience/dto/profile'
import { AnalyticsStateful } from './analytics'
import CoreBase, { type CoreConfigDefaults, type CoreConfig } from './CoreBase'
import { consent, effect, experiences, flags, profile } from './signals'
import type { EventBuilder } from './lib/builders'

export type CoreStatefulConfig = CoreConfig & {
  defaults?: CoreConfigDefaults & {
    consent?: boolean
  }
}

export interface Subscription {
  unsubscribe: () => void
}

export interface Observable<T> {
  subscribe: (next: (v: T) => void) => Subscription
}

export interface States {
  consent: Observable<boolean | undefined>
  experiences: Observable<ExperienceArrayType | undefined>
  flags: Observable<Flags | undefined>
  profile: Observable<ProfileType | undefined>
}

function toObservable<T>(s: { value: T }): Observable<T> {
  return {
    subscribe(next) {
      const dispose = effect(() => {
        next(s.value)
      })

      return { unsubscribe: dispose }
    },
  }
}

class CoreStateful extends CoreBase {
  readonly analytics: AnalyticsStateful

  readonly states: States = {
    consent: toObservable(consent),
    experiences: toObservable(experiences),
    flags: toObservable(flags),
    profile: toObservable(profile),
  }

  constructor(config: CoreStatefulConfig, builder: EventBuilder) {
    super(config, builder)

    this.analytics = new AnalyticsStateful(this.api, builder)
  }
}

export default CoreStateful

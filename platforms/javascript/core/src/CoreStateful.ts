import { AnalyticsStateful } from './analytics'
import CoreBase, { type CoreConfig } from './CoreBase'
import type { Flags } from './lib/api-client/experience/dto/change'
import type { ExperienceEvent as PersonalizationEvent } from './lib/api-client/experience/dto/event'
import type { Profile } from './lib/api-client/experience/dto/profile'
import type { SelectedVariantArray } from './lib/api-client/experience/dto/variant'
import type { InsightsEvent as AnalyticsEvent } from './lib/api-client/insights/dto'
import { consent, effect, event, flags, profile, variants } from './signals'

export interface Subscription {
  unsubscribe: () => void
}

export interface Observable<T> {
  subscribe: (next: (v: T) => void) => Subscription
}

export interface States {
  consent: Observable<boolean | undefined>
  eventStream: Observable<AnalyticsEvent | PersonalizationEvent | undefined>
  flags: Observable<Flags | undefined>
  profile: Observable<Profile | undefined>
  variants: Observable<SelectedVariantArray | undefined>
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
    eventStream: toObservable(event),
    flags: toObservable(flags),
    profile: toObservable(profile),
    variants: toObservable(variants),
  }

  constructor(config: CoreConfig) {
    super(config)

    this.analytics = new AnalyticsStateful(this.api, this.eventBuilder)
  }
}

export default CoreStateful

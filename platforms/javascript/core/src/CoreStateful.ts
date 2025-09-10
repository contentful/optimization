import { AnalyticsStateful } from './analytics'
import CoreBase, { type CoreConfig, type CoreConfigDefaults } from './CoreBase'
import type { Flags } from './lib/api-client/experience/dto/change'
import type { ExperienceEvent as PersonalizationEvent } from './lib/api-client/experience/dto/event'
import type { Profile } from './lib/api-client/experience/dto/profile'
import type { SelectedVariantArray } from './lib/api-client/experience/dto/variant'
import type { InsightsEvent as AnalyticsEvent } from './lib/api-client/insights/dto'
import type { EventBuilder } from './lib/builders'
import { consent, effect, event, flags, profile, variants } from './signals'

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
  variants: Observable<SelectedVariantArray | undefined>
  eventStream: Observable<AnalyticsEvent | PersonalizationEvent | undefined>
  flags: Observable<Flags | undefined>
  profile: Observable<Profile | undefined>
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
    variants: toObservable(variants),
    eventStream: toObservable(event),
    flags: toObservable(flags),
    profile: toObservable(profile),
  }

  constructor(config: CoreStatefulConfig, builder: EventBuilder) {
    super(config, builder)

    this.analytics = new AnalyticsStateful(this.api, builder)
  }
}

export default CoreStateful

import { effect, signal } from '@preact/signals-core'
import type { ProfileType } from './lib/api-client/experience/dto/profile'
import type { ExperienceArrayType } from './lib/api-client/experience/dto/experience'
import type { ChangeArrayType } from './lib/api-client/experience/dto/change'
import { AnalyticsStateful } from './analytics'
import { FlagsStateful } from './flags'
import { PersonalizationStateful } from './personalization'
import CoreBase, { type CoreConfigDefaults, type CoreConfig, signals } from './CoreBase'

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
  audiences: Observable<string[] | undefined>
  consent: Observable<boolean | undefined>
  experiments: Observable<ExperienceArrayType | undefined>
  flags: Observable<ChangeArrayType | undefined>
  personalizations: Observable<ExperienceArrayType | undefined>
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

export const consent = signal<boolean | undefined>()

class CoreStateful extends CoreBase {
  readonly analytics: AnalyticsStateful
  readonly flags: FlagsStateful
  readonly personalization: PersonalizationStateful
  readonly #consent = consent

  readonly states: States = {
    audiences: toObservable(signals.audiences),
    consent: toObservable(this.#consent),
    experiments: toObservable(signals.experiments),
    flags: toObservable(signals.flags),
    personalizations: toObservable(signals.personalizations),
    profile: toObservable(signals.profile),
  }

  constructor(config: CoreStatefulConfig) {
    super(config)

    this.analytics = new AnalyticsStateful(signals, this.api)
    this.flags = new FlagsStateful(signals)
    this.personalization = new PersonalizationStateful(signals, this.api)
  }

  public consent(consent: boolean): void {
    this.#consent.value = consent
  }
}

export default CoreStateful

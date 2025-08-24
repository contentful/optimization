import { batch, effect, signal, type Signal } from '@preact/signals-core'
import type { ProfileType } from './lib/api-client/experience/dto/profile'
import type { ExperienceArrayType } from './lib/api-client/experience/dto/experience'
import type { ChangeArrayType } from './lib/api-client/experience/dto/change'
import { AnalyticsStateful } from './analytics'
import { AudienceStateful } from './audience'
import { ExperimentsStateful } from './experiments'
import { FlagsStateful } from './flags'
import { PersonalizationStateful } from './personalization'
import CoreBase, { type CoreConfigDefaults, type CoreConfig } from './CoreBase'

export type CoreStatefulConfig = CoreConfig & {
  defaults?: CoreConfigDefaults & {
    consent?: boolean
  }
}

export interface Signals {
  audiences: Signal<string[] | undefined>
  consent: Signal<boolean | undefined>
  experiments: Signal<ExperienceArrayType | undefined>
  flags: Signal<ChangeArrayType | undefined>
  personalizations: Signal<ExperienceArrayType | undefined>
  profile: Signal<ProfileType | undefined>
}

export interface Stores {
  audiences: Observable<string[] | undefined>
  consent: Observable<boolean | undefined>
  experiments: Observable<ExperienceArrayType | undefined>
  flags: Observable<ChangeArrayType | undefined>
  personalizations: Observable<ExperienceArrayType | undefined>
  profile: Observable<ProfileType | undefined>
}

export interface Subscription {
  unsubscribe: () => void
}
export interface Observable<T> {
  subscribe: (next: (v: T) => void) => Subscription
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
  readonly audience: AudienceStateful
  readonly experiments: ExperimentsStateful
  readonly flags: FlagsStateful
  readonly personalization: PersonalizationStateful

  private readonly signals: Signals = {
    audiences: signal<string[] | undefined>(),
    consent: signal<boolean | undefined>(),
    experiments: signal<ExperienceArrayType | undefined>(),
    flags: signal<ChangeArrayType | undefined>(),
    personalizations: signal<ExperienceArrayType | undefined>(),
    profile: signal<ProfileType | undefined>(),
  }

  readonly stores: Stores = {
    audiences: toObservable(this.signals.audiences),
    consent: toObservable(this.signals.consent),
    experiments: toObservable(this.signals.experiments),
    flags: toObservable(this.signals.flags),
    personalizations: toObservable(this.signals.personalizations),
    profile: toObservable(this.signals.profile),
  }

  constructor(config: CoreStatefulConfig) {
    super(config)

    const { defaults } = config

    if (defaults) this.setDefaults(defaults)

    this.analytics = new AnalyticsStateful(this.signals, this.api)
    this.audience = new AudienceStateful(this.signals)
    this.experiments = new ExperimentsStateful(this.signals)
    this.flags = new FlagsStateful(this.signals)
    this.personalization = new PersonalizationStateful(this.signals, this.api)
  }

  public consent(consent: boolean): void {
    this.signals.consent.value = consent
  }

  private setDefaults(defaults: CoreStatefulConfig['defaults']): void {
    if (!defaults) return

    const { audiences, consent, experiments, flags, personalizations, profile } = defaults

    batch(() => {
      this.signals.audiences.value = audiences
      this.signals.consent.value = consent
      this.signals.experiments.value = experiments
      this.signals.flags.value = flags
      this.signals.personalizations.value = personalizations
      this.signals.profile.value = profile
    })
  }
}

export default CoreStateful

import { batch, computed, effect, signal, type Signal } from '@preact/signals-core'
import type { ChangeArray, Flags } from './lib/api-client/experience/dto/change'
import type { ExperienceEvent as PersonalizationEvent } from './lib/api-client/experience/dto/event'
import type { SelectedPersonalizationArray } from './lib/api-client/experience/dto/personalization'
import type { Profile } from './lib/api-client/experience/dto/profile'
import type { InsightsEvent as AnalyticsEvent } from './lib/api-client/insights/dto'
import { FlagsResolver } from './personalization/resolvers'

export const changes: Signal<ChangeArray | undefined> = signal<ChangeArray | undefined>()

export const consent = signal<boolean | undefined>()

export const personalizations = signal<SelectedPersonalizationArray | undefined>()

export const event: Signal<AnalyticsEvent | PersonalizationEvent | undefined> = signal<
  AnalyticsEvent | PersonalizationEvent | undefined
>()

export const flags = computed<Flags | undefined>(() => FlagsResolver.resolve(changes.value ?? []))

export const profile: Signal<Profile | undefined> = signal<Profile | undefined>()

export interface Signals {
  changes: typeof changes
  consent: typeof consent
  event: typeof event
  flags: typeof flags
  profile: typeof profile
  personalizations: typeof personalizations
}

export const signals: Signals = {
  changes,
  consent,
  event,
  flags,
  profile,
  personalizations,
}

export { batch, effect, type Signal }

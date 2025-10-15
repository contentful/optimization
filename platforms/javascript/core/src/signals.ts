import type {
  InsightsEvent as AnalyticsEvent,
  ChangeArray,
  Flags,
  ExperienceEvent as PersonalizationEvent,
  Profile,
  SelectedPersonalizationArray,
} from '@contentful/optimization-api-client'
import { batch, computed, effect, signal, type Signal } from '@preact/signals-core'
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

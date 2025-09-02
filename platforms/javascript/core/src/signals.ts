import { batch, computed, effect, signal, type Signal } from '@preact/signals-core'
import type { ChangeArray, Flags } from './lib/api-client/experience/dto/change'
import type { ExperienceArray } from './lib/api-client/experience/dto/experience'
import type { Profile } from './lib/api-client/experience/dto/profile'
import { FlagMapper } from './lib/mappers'
import type { InsightsEvent as AnalyticsEvent } from './lib/api-client/insights/dto'
import type { ExperienceEvent as PersonalizationEvent } from './lib/api-client/experience/dto/event'

export const changes: Signal<ChangeArray | undefined> = signal<ChangeArray | undefined>()

export const consent = signal<boolean | undefined>()

export const personalizations = signal<ExperienceArray | undefined>()

export const event: Signal<AnalyticsEvent | PersonalizationEvent | undefined> = signal<
  AnalyticsEvent | PersonalizationEvent | undefined
>()

export const flags = computed<Flags | undefined>(() => FlagMapper.mapFlags(changes.value ?? []))

export const profile: Signal<Profile | undefined> = signal<Profile | undefined>()

export { batch, effect, type Signal }

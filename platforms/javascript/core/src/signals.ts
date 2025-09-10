import { batch, computed, effect, signal, type Signal } from '@preact/signals-core'
import type { ChangeArray, Flags } from './lib/api-client/experience/dto/change'
import type { ExperienceEvent as PersonalizationEvent } from './lib/api-client/experience/dto/event'
import type { Profile } from './lib/api-client/experience/dto/profile'
import type { SelectedVariantArray } from './lib/api-client/experience/dto/variant'
import type { InsightsEvent as AnalyticsEvent } from './lib/api-client/insights/dto'
import { FlagSelector } from './lib/selectors'

export const changes: Signal<ChangeArray | undefined> = signal<ChangeArray | undefined>()

export const consent = signal<boolean | undefined>()

export const variants = signal<SelectedVariantArray | undefined>()

export const event: Signal<AnalyticsEvent | PersonalizationEvent | undefined> = signal<
  AnalyticsEvent | PersonalizationEvent | undefined
>()

export const flags = computed<Flags | undefined>(() =>
  FlagSelector.selectFlags(changes.value ?? []),
)

export const profile: Signal<Profile | undefined> = signal<Profile | undefined>()

export { batch, effect, type Signal }

import { batch, computed, effect, signal, type Signal } from '@preact/signals-core'
import type { ChangeArrayType, Flags } from './lib/api-client/experience/dto/change'
import type { ExperienceArrayType } from './lib/api-client/experience/dto/experience'
import type { ProfileType } from './lib/api-client/experience/dto/profile'
import { FlagMapper } from './lib/mappers'

export const changes: Signal<ChangeArrayType | undefined> = signal<ChangeArrayType | undefined>()

export const consent = signal<boolean | undefined>()

export const experiences: Signal<ExperienceArrayType | undefined> = signal<
  ExperienceArrayType | undefined
>()

export const flags = computed<Flags | undefined>(() => FlagMapper.mapFlags(changes.value ?? []))

export const profile: Signal<ProfileType | undefined> = signal<ProfileType | undefined>()

export { batch, effect, type Signal }

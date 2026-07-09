import type {
  ChangeArray,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'

/**
 * Stateful defaults accepted by Core-backed SDK runtimes.
 *
 * @public
 */
export interface StatefulDefaults {
  /** Event consent default. */
  consent?: boolean
  /** Profile-continuity persistence consent default. */
  persistenceConsent?: boolean
  /** Default active profile used for optimization and insights. */
  profile?: Profile
  /** Initial diff of changes produced by the service. */
  changes?: ChangeArray
  /** Preselected optimization variants. */
  selectedOptimizations?: SelectedOptimizationArray
}

export type PersistedDefaultLoader<T> = () => T | undefined
export type PersistedDefaultValue<T> = T | PersistedDefaultLoader<T> | undefined

/**
 * Persisted values supplied by a platform store.
 *
 * @public
 */
export interface PersistedStatefulDefaults {
  /** Persisted event consent. */
  consent?: boolean
  /** Persisted profile-continuity persistence consent. */
  persistenceConsent?: boolean
  /** Persisted active profile, read only when persistence consent permits it. */
  profile?: PersistedDefaultValue<Profile>
  /** Persisted changes, read only when persistence consent permits it. */
  changes?: PersistedDefaultValue<ChangeArray>
  /** Persisted selected optimizations, read only when persistence consent permits it. */
  selectedOptimizations?: PersistedDefaultValue<SelectedOptimizationArray>
}

/**
 * Resolved stateful defaults and the profile-continuity loading decision used
 * to produce them.
 *
 * @public
 */
export interface ResolvedStatefulDefaults {
  /** Defaults to pass to the stateful Core runtime. */
  defaults: StatefulDefaults
  /** Whether platform storage may load profile-continuity values. */
  canLoadPersistedContinuity: boolean
}

const resolveContinuityDefault = <T extends object>(
  configuredValue: T | undefined,
  persistedValue: PersistedDefaultValue<T>,
  canLoadPersistedContinuity: boolean,
): T | undefined => {
  if (configuredValue !== undefined || !canLoadPersistedContinuity) return configuredValue
  if (typeof persistedValue === 'function') return persistedValue()

  return persistedValue
}

/**
 * Resolve stateful defaults from explicit configuration plus platform-persisted values.
 *
 * @param configured - Caller-provided defaults from SDK configuration.
 * @param persisted - Values already loaded or lazily readable from platform storage.
 * @returns The defaults Core should receive and whether durable continuity may be loaded.
 *
 * @public
 */
export function resolveStatefulDefaults(
  configured?: StatefulDefaults,
  persisted: PersistedStatefulDefaults = {},
): ResolvedStatefulDefaults {
  const defaults = configured ?? {}
  const consent = defaults.consent ?? persisted.consent
  const persistenceConsent =
    defaults.persistenceConsent ?? defaults.consent ?? persisted.persistenceConsent
  const canLoadPersistedContinuity = persistenceConsent === true

  return {
    canLoadPersistedContinuity,
    defaults: {
      consent,
      persistenceConsent,
      profile: resolveContinuityDefault(
        defaults.profile,
        persisted.profile,
        canLoadPersistedContinuity,
      ),
      changes: resolveContinuityDefault(
        defaults.changes,
        persisted.changes,
        canLoadPersistedContinuity,
      ),
      selectedOptimizations: resolveContinuityDefault(
        defaults.selectedOptimizations,
        persisted.selectedOptimizations,
        canLoadPersistedContinuity,
      ),
    },
  }
}

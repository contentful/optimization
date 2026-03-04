import type { Profile } from '@contentful/optimization-web/api-schemas'
import type { SignalFns, Signals } from '@contentful/optimization-web/core-sdk'
import { type Context, createContext } from '@lit/context'

/**
 * Signal functions provided by the host Optimization instance.
 *
 * @see {@link SignalFns}
 *
 * @public
 */
export type HostSignalFns = SignalFns

/**
 * Lit context for sharing {@link HostSignalFns} with child components.
 *
 * @public
 */
export const hostSignalFnsContext = createContext<HostSignalFns | undefined, string>(
  'hostSignalFns',
)

/**
 * Signals provided by the host Optimization instance, with personalizations
 * renamed to `selectedPersonalizations` for clarity within the preview panel.
 *
 * @see {@link Signals}
 *
 * @public
 */
export type HostSignals = Omit<Signals, 'personalizations'> & {
  selectedPersonalizations: Signals['personalizations']
}

/**
 * Lit context for sharing {@link HostSignals} with child components.
 *
 * @public
 */
export const hostSignalsContext = createContext<HostSignals | undefined, string>('hostSignals')

/**
 * Lit context for sharing the visitor {@link Profile} with child components.
 *
 * @public
 */
export const profileContext: Context<string, Profile | undefined> = createContext<
  Profile | undefined,
  string
>('profile')

/**
 * Lit context for sharing the active personalization override map with child components.
 *
 * @public
 */
export const overridesContext = createContext<Map<string, number> | undefined, string>('overrides')

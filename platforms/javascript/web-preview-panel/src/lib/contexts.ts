import type { Profile, SignalFns, Signals } from '@contentful/optimization-web'
import { type Context, createContext } from '@lit/context'

export type HostSignalFns = SignalFns
export const hostSignalFnsContext = createContext<HostSignalFns | undefined, string>(
  'hostSignalFns',
)

export type HostSignals = Omit<Signals, 'personalizations'> & {
  selectedPersonalizations: Signals['personalizations']
}
export const hostSignalsContext = createContext<HostSignals | undefined, string>('hostSignals')

export const profileContext: Context<string, Profile | undefined> = createContext<
  Profile | undefined,
  string
>('profile')

export const overridesContext = createContext<Map<string, number> | undefined, string>('overrides')

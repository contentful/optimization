import type { SignalFns, Signals } from '@contentful/optimization-web'
import { createContext } from '@lit/context'

export type HostSignalFns = SignalFns

export type HostSignals = Omit<Signals, 'personalizations'> & {
  selectedPersonalizations: Signals['personalizations']
}

export const hostSignalFnsContext = createContext<HostSignalFns | undefined, string>(
  'hostSignalFns',
)

export const hostSignalsContext = createContext<HostSignals | undefined, string>('hostSignals')

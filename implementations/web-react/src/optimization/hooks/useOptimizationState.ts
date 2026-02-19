import type { CoreStates } from '@contentful/optimization-web'
import { useEffect, useState } from 'react'

interface Subscription {
  unsubscribe: () => void
}

interface Observable<TValue> {
  subscribe: (next: (value: TValue) => void) => Subscription
}

type StateValue<TKey extends keyof CoreStates> = Parameters<
  Parameters<CoreStates[TKey]['subscribe']>[0]
>[0]

export interface OptimizationStateSnapshot {
  consent: boolean | undefined
  eventStream: StateValue<'eventStream'> | undefined
  flags: StateValue<'flags'> | undefined
  personalizations: StateValue<'personalizations'> | undefined
  profile: StateValue<'profile'> | undefined
}

function useObservableState<TValue>(
  observable: Observable<TValue> | undefined,
): TValue | undefined {
  const [value, setValue] = useState<TValue | undefined>(undefined)

  useEffect(() => {
    if (!observable) {
      setValue(undefined)
      return
    }

    const subscription = observable.subscribe((nextValue: TValue) => {
      setValue(nextValue)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [observable])
  return value
}

export function useOptimizationState(sdk: CoreStates | undefined): OptimizationStateSnapshot {
  const consent = useObservableState(sdk?.consent)
  const eventStream = useObservableState(sdk?.eventStream)
  const flags = useObservableState(sdk?.flags)
  const personalizations = useObservableState(sdk?.personalizations)
  const profile = useObservableState(sdk?.profile)

  return {
    consent,
    eventStream,
    flags,
    personalizations,
    profile,
  }
}

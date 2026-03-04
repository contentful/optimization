import type { CoreStates } from '@contentful/optimization-web/core-sdk'
import { useEffect, useState } from 'react'

interface Subscription {
  unsubscribe: () => void
}

interface Observable<TValue> {
  subscribe: (next: (value: TValue) => void) => Subscription
}

interface PreviewPanelStates {
  previewPanelAttached?: Observable<boolean>
  previewPanelOpen?: Observable<boolean>
}

type OptimizationStateSource = CoreStates & PreviewPanelStates

type StateValue<TKey extends keyof CoreStates> = Parameters<
  Parameters<CoreStates[TKey]['subscribe']>[0]
>[0]

export interface OptimizationStateSnapshot {
  consent: boolean | undefined
  eventStream: StateValue<'eventStream'> | undefined
  flags: StateValue<'flags'> | undefined
  personalizations: StateValue<'personalizations'> | undefined
  previewPanelAttached: boolean | undefined
  previewPanelOpen: boolean | undefined
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

export function useOptimizationState(
  sdk: OptimizationStateSource | undefined,
): OptimizationStateSnapshot {
  const consent = useObservableState(sdk?.consent)
  const eventStream = useObservableState(sdk?.eventStream)
  const flags = useObservableState(sdk?.flags)
  const personalizations = useObservableState(sdk?.personalizations)
  const previewPanelAttached = useObservableState(sdk?.previewPanelAttached)
  const previewPanelOpen = useObservableState(sdk?.previewPanelOpen)
  const profile = useObservableState(sdk?.profile)

  return {
    consent,
    eventStream,
    flags,
    personalizations,
    previewPanelAttached,
    previewPanelOpen,
    profile,
  }
}

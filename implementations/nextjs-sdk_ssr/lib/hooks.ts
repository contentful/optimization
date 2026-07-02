'use client'

import {
  useConsentState,
  useOptimization,
  useOptimizationActions,
  useOptimizationContext,
  useProfileState,
  useSelectedOptimizationsState,
} from '@contentful/optimization-nextjs/client'
import { useEffect, useReducer, useRef, useState } from 'react'
import { setAppConsent } from './util'

type Profile = ReturnType<typeof useProfileState>

type ServerDefaults = {
  readonly profile?: Profile
  readonly selectedOptimizations?: readonly unknown[]
}

export type ControlPanelServerState = ServerDefaults & { readonly hasConsent?: boolean }

export function useControlPanel(serverState: ControlPanelServerState = {}) {
  const sdk = useOptimization()
  const { identify, reset, consent: setConsent } = useOptimizationActions()
  const sdkConsent = useConsentState()
  const clientProfile = useProfileState()
  const selectedOptimizations = useSelectedOptimizationsState()
  const { sdk: sdkCtx, isReady } = useOptimizationContext()
  const profile = isReady ? clientProfile : (clientProfile ?? serverState.profile)
  const [booleanFlag, setBooleanFlag] = useState<unknown>(undefined)

  useEffect(() => {
    if (!sdkCtx || !isReady) return
    const subscription = sdkCtx.states.flag('boolean').subscribe(setBooleanFlag)
    return () => subscription.unsubscribe()
  }, [isReady, sdkCtx])

  const consent = sdkConsent ?? serverState.hasConsent
  const activeCount =
    selectedOptimizations?.length ?? serverState.selectedOptimizations?.length ?? 0

  useEffect(() => {
    if (typeof consent === 'boolean') setAppConsent(consent)
  }, [consent])

  return {
    sdk,
    identify,
    reset,
    consent,
    setConsent,
    profile,
    activeCount,
    booleanFlag,
  }
}

const MS_PER_SECOND = 1000
const TICK_INTERVAL_SECONDS = 5

export function useTick(): void {
  const [, tick] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    const id = setInterval(tick, MS_PER_SECOND * TICK_INTERVAL_SECONDS)
    return () => {
      clearInterval(id)
    }
  }, [])
}

interface EventStreamState<T> {
  events: T[]
  rawCount: number
}

export function useEventStream<T>(
  parse: (event: unknown, id: string) => T | undefined,
  update: (previous: T[], next: T) => T[],
): EventStreamState<T> {
  const { sdk, isReady } = useOptimizationContext()
  const [events, setEvents] = useState<T[]>([])
  const [rawCount, setRawCount] = useState(0)
  const nextId = useRef(0)
  const parseRef = useRef(parse)
  const updateRef = useRef(update)

  useEffect(() => {
    if (!isReady || sdk === undefined) return

    const subscription = sdk.states.eventStream.subscribe((event: unknown) => {
      const id = `event-${nextId.current}`
      const parsed = parseRef.current(event, id)
      if (!parsed) return
      nextId.current += 1
      setRawCount((n) => n + 1)
      setEvents((previous) => updateRef.current(previous, parsed))
    })

    return () => {
      subscription.unsubscribe()
      setEvents([])
      setRawCount(0)
      nextId.current = 0
    }
  }, [isReady, sdk])

  return { events, rawCount }
}

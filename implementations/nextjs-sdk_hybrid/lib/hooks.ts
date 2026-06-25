'use client'

import {
  useConsentState,
  useOptimization,
  useOptimizationActions,
  useOptimizationContext,
} from '@contentful/optimization-nextjs/client'
import { useEffect, useReducer, useRef, useState } from 'react'
import { setAppConsent } from './util'

export function useConsent(): {
  consent: boolean | undefined
  setConsent: (value: boolean) => void
} {
  const consent = useConsentState()
  const { consent: setConsent } = useOptimizationActions()
  useEffect(() => {
    if (typeof consent === 'boolean') setAppConsent(consent)
  }, [consent])
  return { consent, setConsent }
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

export function useFlagSubscription(flagName: string): unknown {
  const { sdk, isReady } = useOptimizationContext()
  const [value, setValue] = useState<unknown>(undefined)

  useEffect(() => {
    if (!sdk || !isReady) return
    const subscription = sdk.states.flag(flagName).subscribe(setValue)
    return () => {
      subscription.unsubscribe()
    }
  }, [isReady, sdk, flagName])

  return value
}

export function useManualViewTracking(
  manualTracking: boolean | undefined,
): (element: HTMLDivElement | null, entryId: string) => void {
  const sdk = useOptimization()
  const trackedElement = useRef<HTMLDivElement | null>(null)

  useEffect(
    () => () => {
      const { current } = trackedElement
      if (current) sdk.tracking.clearElement('views', current)
    },
    [sdk.tracking],
  )

  return (element: HTMLDivElement | null, entryId: string): void => {
    const { current: previous } = trackedElement
    if (previous && previous !== element) sdk.tracking.clearElement('views', previous)
    trackedElement.current = element
    if (!element || !manualTracking) return
    sdk.tracking.enableElement('views', element, { data: { entryId } })
  }
}

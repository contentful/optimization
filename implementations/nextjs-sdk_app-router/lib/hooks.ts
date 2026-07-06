'use client'

import {
  useConsentState,
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
  const { setConsent } = useOptimizationActions()
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
  const { sdk } = useOptimizationContext()
  const [events, setEvents] = useState<T[]>([])
  const [rawCount, setRawCount] = useState(0)
  const nextId = useRef(0)
  const parseRef = useRef(parse)
  const updateRef = useRef(update)

  useEffect(() => {
    if (sdk === undefined) return

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
  }, [sdk])

  return { events, rawCount }
}

export function useFlagSubscription(flagName: string): unknown {
  const { sdk } = useOptimizationContext()
  const [value, setValue] = useState<unknown>(undefined)

  useEffect(() => {
    if (sdk === undefined) return
    const subscription = sdk.states.flag(flagName).subscribe(setValue)
    return () => {
      subscription.unsubscribe()
    }
  }, [sdk, flagName])

  return value
}

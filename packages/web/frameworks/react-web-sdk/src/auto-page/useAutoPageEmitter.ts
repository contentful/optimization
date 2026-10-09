import type { OptimizationHandoff } from '@contentful/optimization-web/core-sdk'
import { useEffect, useRef } from 'react'
import { useOptimizationContext } from '../hooks/useOptimization'
import { useConsentState } from '../hooks/useOptimizationState'
import type { AutoPagePayload } from './types'

export interface AutoPageEmissionMetadata {
  readonly isInitialEmission: boolean
}

export interface UseAutoPageEmitterArgs {
  readonly enabled: boolean
  readonly routeKey: string
  readonly handoff?: OptimizationHandoff
  readonly buildPayload?: (metadata: AutoPageEmissionMetadata) => AutoPagePayload
}

/** Delegate router invocation to the existing Web tracking/admission operation. @internal */
export function useAutoPageEmitter({
  enabled,
  routeKey,
  handoff,
  buildPayload,
}: UseAutoPageEmitterArgs): void {
  const { sdk, isLive } = useOptimizationContext()
  const consent = useConsentState()
  const acceptedHandoff = useRef<string | OptimizationHandoff | undefined>(undefined)
  const handoffKey = handoff?.replay?.events.at(-1)?.messageId ?? handoff

  useEffect(() => {
    if (!enabled || isLive === false || sdk === undefined) return
    const shouldInitialize = handoff !== undefined && acceptedHandoff.current !== handoffKey
    if (!shouldInitialize && buildPayload === undefined) return

    const emission = shouldInitialize
      ? sdk.hydrateAndTrackCurrentPage(handoff, { routeKey, buildPayload })
      : sdk.trackCurrentPage({ routeKey, buildPayload: buildPayload ?? (() => ({})) })
    void emission
      .then((result) => {
        if (shouldInitialize && result.accepted) acceptedHandoff.current = handoffKey
      })
      .catch(() => undefined)
  }, [buildPayload, consent, enabled, handoff, handoffKey, isLive, routeKey, sdk])
}

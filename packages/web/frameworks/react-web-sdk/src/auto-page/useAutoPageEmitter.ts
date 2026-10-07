import type { OptimizationHandoff } from '@contentful/optimization-web/core-sdk'
import { useEffect } from 'react'
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

  useEffect(() => {
    if (!enabled || isLive === false || sdk === undefined) return
    if (handoff === undefined && buildPayload === undefined) return

    const emission =
      handoff === undefined
        ? sdk.trackCurrentPage({ routeKey, buildPayload: buildPayload ?? (() => ({})) })
        : sdk.hydrateAndTrackCurrentPage(handoff, { routeKey, buildPayload })
    void emission.catch(() => undefined)
  }, [buildPayload, consent, enabled, handoff, isLive, routeKey, sdk])
}

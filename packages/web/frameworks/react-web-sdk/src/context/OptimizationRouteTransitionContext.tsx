import type { ContentOptimizationHandoff } from '@contentful/optimization-web/handoff'
import { createContext, useContext } from 'react'
import type { OptimizationSdk } from './OptimizationContext'

export type RouteSettlement = 'failed' | 'satisfied' | 'satisfied-with-response' | 'superseded'

export interface RoutePresentation {
  readonly handoff: ContentOptimizationHandoff | undefined
  readonly isLiveRuntimeAuthoritative: boolean
  readonly isPending: boolean
  readonly routeKey: string | undefined
  readonly useSnapshot: boolean
}

export function isHydratedHandoff(
  handoff: ContentOptimizationHandoff | undefined,
  hydratedHandoff: ContentOptimizationHandoff | undefined,
): boolean {
  return handoff !== undefined && hydratedHandoff === handoff
}

export function hasAuthoritativeLiveRuntime(
  isLive: boolean,
  presentation: RoutePresentation | undefined,
): boolean {
  return isLive && presentation?.isLiveRuntimeAuthoritative !== false
}

interface OptimizationRouteTransitionContextValue {
  readonly isHandoffPending: boolean
  readonly isLiveRuntimeAuthoritative: boolean
  readonly isPresentationLive: boolean
  readonly presentationSdk: OptimizationSdk | undefined
  readonly settleRoute: (routeKey: string, settlement: RouteSettlement) => void
  readonly startRoute: (routeKey: string) => void
}

export const OptimizationRouteTransitionContext =
  createContext<OptimizationRouteTransitionContextValue | null>(null)

export function useOptimizationRouteTransition(): OptimizationRouteTransitionContextValue | null {
  return useContext(OptimizationRouteTransitionContext)
}

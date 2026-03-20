import type { OptimizationSdk } from '../context/OptimizationContext'

export type AutoPagePayload = Parameters<OptimizationSdk['page']>[0]

export interface AutoPageRouteState<TRouteContext> {
  readonly context: TRouteContext
  readonly routeKey: string
}

export interface AutoPageEmissionContext<TRouteContext> extends AutoPageRouteState<TRouteContext> {
  readonly isInitialEmission: boolean
}

export interface AutoPagePayloadOptions<TRouteContext> {
  readonly pagePayload?: AutoPagePayload
  readonly getPagePayload?: (
    context: AutoPageEmissionContext<TRouteContext>,
  ) => AutoPagePayload | undefined
}

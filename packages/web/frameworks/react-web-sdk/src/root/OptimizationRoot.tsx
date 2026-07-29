import type { TrackCurrentPageOptions } from '@contentful/optimization-web'
import type { ContentOptimizationHandoff } from '@contentful/optimization-web/handoff'
import { useEffect, useRef, type ReactElement } from 'react'

import type { AutoPagePayload } from '../auto-page/types'
import { useAutoPageEmitter } from '../auto-page/useAutoPageEmitter'
import { createScopedLogger } from '../logger'
import { LiveUpdatesProvider } from '../provider/LiveUpdatesProvider'
import {
  OptimizationProvider,
  type OptimizationProviderConfigProps,
} from '../provider/OptimizationProvider'

export type OptimizationRootProps = OptimizationProviderConfigProps & {
  readonly liveUpdates?: boolean
  readonly routeKey?: string
  readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
  readonly initialPagePayload?: AutoPagePayload
}

const logger = createScopedLogger('React:OptimizationRoot')

function InitialHandoffPageEmitter({
  buildPagePayload,
  handoff,
  routeKey,
}: {
  readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
  readonly handoff: ContentOptimizationHandoff
  readonly routeKey: string
}): null {
  useAutoPageEmitter({
    buildPayload: buildPagePayload,
    enabled: true,
    initialPageEvent: handoff.initialPageEvent,
    routeKey,
  })

  return null
}

type InitialHandoffPageEmitterProps = Parameters<typeof InitialHandoffPageEmitter>[0]

function MissingInitialPagePayloadWarning(): null {
  useEffect(() => {
    logger.warn(
      'OptimizationRoot handoff requested initial page emission without routeKey and buildPagePayload; skipping initial page event.',
    )
  }, [])

  return null
}

function resolveInitialPageEmitterProps({
  buildPagePayload,
  handoff,
  initialPagePayload,
  initialRouteKey,
  routeKey,
}: {
  readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
  readonly handoff?: ContentOptimizationHandoff
  readonly initialPagePayload?: AutoPagePayload
  readonly initialRouteKey?: string
  readonly routeKey?: string
}): InitialHandoffPageEmitterProps | undefined {
  if (handoff === undefined) return undefined

  const resolvedBuildPagePayload =
    buildPagePayload ?? (initialPagePayload === undefined ? undefined : () => initialPagePayload)

  if (routeKey !== undefined && resolvedBuildPagePayload !== undefined) {
    return { buildPagePayload: resolvedBuildPagePayload, handoff, routeKey }
  }

  if (
    handoff.initialPageEvent === 'skip' &&
    initialRouteKey !== undefined &&
    resolvedBuildPagePayload === undefined
  ) {
    return { handoff, routeKey: initialRouteKey }
  }

  return undefined
}

function shouldWarnMissingInitialPagePayload({
  buildPagePayload,
  handoff,
  initialPagePayload,
  routeKey,
}: {
  readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
  readonly handoff?: ContentOptimizationHandoff
  readonly initialPagePayload?: AutoPagePayload
  readonly routeKey?: string
}): boolean {
  return (
    handoff?.initialPageEvent === 'emit' &&
    (routeKey === undefined || (buildPagePayload === undefined && initialPagePayload === undefined))
  )
}

export function OptimizationRoot({
  buildPagePayload,
  children,
  handoff,
  initialPagePayload,
  liveUpdates = false,
  routeKey,
  ...providerProps
}: OptimizationRootProps): ReactElement {
  const initialRouteKey = useRef<string | undefined>(undefined)
  initialRouteKey.current ??= routeKey
  const initialPageEmitterProps = resolveInitialPageEmitterProps({
    buildPagePayload,
    handoff,
    initialPagePayload,
    initialRouteKey: initialRouteKey.current,
    routeKey,
  })
  const shouldWarnMissingPayload = shouldWarnMissingInitialPagePayload({
    buildPagePayload,
    handoff,
    initialPagePayload,
    routeKey,
  })

  return (
    <OptimizationProvider {...providerProps} handoff={handoff}>
      {shouldWarnMissingPayload ? <MissingInitialPagePayloadWarning /> : null}
      {initialPageEmitterProps ? <InitialHandoffPageEmitter {...initialPageEmitterProps} /> : null}
      <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>{children}</LiveUpdatesProvider>
    </OptimizationProvider>
  )
}

import type { TrackCurrentPageOptions } from '@contentful/optimization-web'
import {
  hydrateOptimizationAnalyticsHandoff,
  initializeOptimizationAnalyticsRuntime,
  type AnalyticsOptimizationHandoff,
  type OptimizationAnalyticsRuntime,
} from '@contentful/optimization-web/analytics'
import {
  resolveTrackEntryInteractionOptions,
  type OptimizationRootSdkConfig,
  type TrackEntryInteractionOptions,
} from '@contentful/optimization-web/presentation'
import { useLayoutEffect, useMemo, useRef, type PropsWithChildren, type ReactElement } from 'react'

import type { AutoPagePayload } from '../auto-page/types'
import { createScopedLogger } from '../logger'

export type OptimizationAnalyticsRootProps = PropsWithChildren<
  OptimizationRootSdkConfig & {
    readonly handoff: AnalyticsOptimizationHandoff
    readonly routeKey: string
    readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
    readonly initialPagePayload?: AutoPagePayload
    readonly trackEntryInteraction?: TrackEntryInteractionOptions
  }
>

const logger = createScopedLogger('React:OptimizationAnalyticsRoot')

function initializeAnalyticsRuntime(
  props: OptimizationAnalyticsRootProps,
): OptimizationAnalyticsRuntime {
  const {
    buildPagePayload: _buildPagePayload,
    children: _children,
    handoff: _handoff,
    initialPagePayload: _initialPagePayload,
    routeKey: _routeKey,
    trackEntryInteraction,
    ...config
  } = props

  return initializeOptimizationAnalyticsRuntime({
    ...config,
    autoTrackEntryInteraction: resolveTrackEntryInteractionOptions(trackEntryInteraction),
  })
}

export function OptimizationAnalyticsRoot(props: OptimizationAnalyticsRootProps): ReactElement {
  const { buildPagePayload, children, handoff, initialPagePayload, routeKey } = props
  const initialPropsRef = useRef(props)
  const runtimeRef = useRef<OptimizationAnalyticsRuntime | undefined>(undefined)
  const resolvedBuildPagePayload = useMemo(
    () => buildPagePayload ?? (() => initialPagePayload),
    [buildPagePayload, initialPagePayload],
  )

  useLayoutEffect(() => {
    const runtime = initializeAnalyticsRuntime(initialPropsRef.current)
    runtimeRef.current = runtime

    return () => {
      runtimeRef.current = undefined
      runtime.destroy()
    }
  }, [])

  useLayoutEffect(() => {
    const { current: runtime } = runtimeRef
    if (runtime === undefined) return

    let disposed = false

    void hydrateOptimizationAnalyticsHandoff(runtime, handoff, {
      buildPagePayload: resolvedBuildPagePayload,
      routeKey,
    }).catch((error: unknown) => {
      if (!disposed) {
        logger.warn('OptimizationAnalyticsRoot failed to hydrate handoff.', error)
      }
    })

    return () => {
      disposed = true
    }
  }, [handoff, resolvedBuildPagePayload, routeKey])

  return <>{children}</>
}

import type { TrackCurrentPageOptions } from '@contentful/optimization-web'
import { useRef, type ReactElement } from 'react'

import type { AutoPagePayload } from '../auto-page/types'
import { useAutoPageEmitter } from '../auto-page/useAutoPageEmitter'
import {
  resolveBeforeInitialPageMaxWaitMs,
  runBeforeInitialPage,
  type BeforeInitialPageOptions,
} from '../before-initial-page/beforeInitialPage'
import { LiveUpdatesProvider } from '../provider/LiveUpdatesProvider'
import {
  OptimizationProvider,
  type InitializeProviderSdk,
  type OptimizationProviderConfigProps,
} from '../provider/OptimizationProvider'

interface OptimizationRootCommonProps {
  readonly liveUpdates?: boolean
}

interface OptimizationRootWithoutBeforeInitialPageProps {
  readonly beforeInitialPage?: never
  readonly routeKey?: string
  readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
  readonly initialPagePayload?: AutoPagePayload
}

interface OptimizationRootWithBeforeInitialPageProps {
  readonly beforeInitialPage: BeforeInitialPageOptions
  readonly routeKey: string
  readonly buildPagePayload: NonNullable<TrackCurrentPageOptions['buildPayload']>
  readonly initialPagePayload?: never
}

export type OptimizationRootProps = OptimizationProviderConfigProps &
  OptimizationRootCommonProps &
  (OptimizationRootWithoutBeforeInitialPageProps | OptimizationRootWithBeforeInitialPageProps)

/** Preview content and ordinary routing do not wait for initial event delivery. */
export function OptimizationRoot(props: OptimizationRootProps): ReactElement {
  const {
    children,
    handoff,
    beforeInitialPage,
    buildPagePayload,
    initialPagePayload,
    liveUpdates = false,
    routeKey,
    ...providerProps
  } = props
  const latest = useRef({ routeKey, buildPagePayload, initialPagePayload, beforeInitialPage })
  latest.current = { routeKey, buildPagePayload, initialPagePayload, beforeInitialPage }
  const maxWaitMs =
    beforeInitialPage === undefined
      ? undefined
      : resolveBeforeInitialPageMaxWaitMs(beforeInitialPage.maxWaitMs)
  const initializeSdk: InitializeProviderSdk | undefined =
    routeKey === undefined || (handoff === undefined && beforeInitialPage === undefined)
      ? undefined
      : async (sdk, ready, isCurrent) => {
          const currentPage = (): TrackCurrentPageOptions => ({
            routeKey: latest.current.routeKey ?? routeKey,
            buildPayload:
              latest.current.buildPagePayload ??
              (latest.current.initialPagePayload === undefined
                ? undefined
                : () => latest.current.initialPagePayload),
          })
          return await sdk.hydrateAndTrackCurrentPage(handoff, {
            ...currentPage(),
            getCurrentPage: currentPage,
            isCurrent,
            onHydrated: ready,
            beforeInitialPage: async () => {
              const {
                current: { beforeInitialPage: callback },
              } = latest
              if (callback !== undefined)
                await runBeforeInitialPage(
                  sdk,
                  callback,
                  maxWaitMs ?? resolveBeforeInitialPageMaxWaitMs(callback.maxWaitMs),
                )
            },
          })
        }
  return (
    <OptimizationProvider {...providerProps} handoff={handoff} initializeSdk={initializeSdk}>
      {initializeSdk !== undefined && routeKey !== undefined ? (
        <PageEmitter
          routeKey={routeKey}
          buildPagePayload={
            buildPagePayload ??
            (initialPagePayload === undefined ? undefined : () => initialPagePayload)
          }
        />
      ) : null}
      <LiveUpdatesProvider globalLiveUpdates={liveUpdates}>{children}</LiveUpdatesProvider>
    </OptimizationProvider>
  )
}

function PageEmitter({
  routeKey,
  buildPagePayload,
}: {
  readonly routeKey: string
  readonly buildPagePayload?: TrackCurrentPageOptions['buildPayload']
}): null {
  useAutoPageEmitter({ routeKey, buildPayload: buildPagePayload, enabled: true })
  return null
}

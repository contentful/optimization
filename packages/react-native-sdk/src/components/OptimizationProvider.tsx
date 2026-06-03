import type { CoreStatefulConfig as OptimizationConfig } from '@contentful/optimization-core'
import { createScopedLogger } from '@contentful/optimization-core/logger'
import React, { useEffect, useRef, useState, type ReactNode } from 'react'
import ContentfulOptimization from '../ContentfulOptimization'
import OptimizationContext from '../context/OptimizationContext'

const logger = createScopedLogger('RN:Provider')

type OnStatesReadyResult = ReturnType<() => void> | (() => void)

export type OnStatesReady = (states: ContentfulOptimization['states']) => OnStatesReadyResult

type Cleanup = () => void

interface ProviderState {
  error: Error | undefined
  isReady: boolean
  sdk: ContentfulOptimization | undefined
}

/**
 * Props for the {@link OptimizationProvider} component.
 *
 * Accepts all `OptimizationConfig` properties directly. Only `clientId` is required.
 *
 * @public
 */
export interface OptimizationProviderConfigProps extends OptimizationConfig {
  /**
   * Children components that will have access to the {@link ContentfulOptimization} instance.
   */
  children?: ReactNode
  /**
   * Called once SDK state initialization completes and before provider children mount.
   * Return a cleanup function to unsubscribe app-level state observers on teardown.
   */
  onStatesReady?: OnStatesReady
  sdk?: never
}

export interface OptimizationProviderSdkProps {
  /**
   * Children components that will have access to the {@link ContentfulOptimization} instance.
   */
  children?: ReactNode
  /**
   * Called with the injected SDK state surface before provider children mount.
   * Return a cleanup function to unsubscribe app-level state observers on teardown.
   */
  onStatesReady?: OnStatesReady
  sdk: ContentfulOptimization
}

export type OptimizationProviderProps =
  | OptimizationProviderConfigProps
  | OptimizationProviderSdkProps

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function getCleanup(
  sdk: ContentfulOptimization,
  onStatesReady: OnStatesReady | undefined,
): Cleanup | undefined {
  const cleanup = onStatesReady?.(sdk.states)
  return typeof cleanup === 'function' ? cleanup : undefined
}

/**
 * Provides the {@link ContentfulOptimization} instance to all child components via React Context.
 *
 * Handles SDK initialization, loading state, and cleanup internally.
 * Children are not rendered while provider-owned SDK initialization is pending.
 *
 * @param props - Config properties and children
 * @returns `null` while initialization is pending, then a context provider for ready or error state
 *
 * @remarks
 * Config is captured on first render, except `locale`, which updates the SDK live.
 * To force full re-initialization, change the React `key` prop.
 *
 * Prefer using {@link OptimizationRoot} instead, which wraps this provider
 * with additional functionality such as live updates and the preview panel.
 *
 * @example
 * ```tsx
 * <OptimizationProvider clientId="your-client-id" environment="main">
 *   <App />
 * </OptimizationProvider>
 * ```
 *
 * @see {@link OptimizationRoot}
 *
 * @public
 */
export function OptimizationProvider(props: OptimizationProviderProps): React.JSX.Element | null {
  const { children } = props
  const initialPropsRef = useRef(props)
  const liveLocale = props.sdk === undefined ? props.locale : undefined
  const cleanupRef = useRef<Cleanup | undefined>(undefined)
  const ownsSdkRef = useRef(false)
  const sdkRef = useRef<ContentfulOptimization | undefined>(undefined)
  const [state, setState] = useState<ProviderState>(() => ({
    error: undefined,
    isReady: !props.onStatesReady && props.sdk !== undefined,
    sdk: props.onStatesReady ? undefined : props.sdk,
  }))

  useEffect(() => {
    let destroyed = false

    function dispose(): void {
      cleanupRef.current?.()
      cleanupRef.current = undefined

      if (ownsSdkRef.current) {
        sdkRef.current?.destroy()
      }

      ownsSdkRef.current = false
      sdkRef.current = undefined
    }

    const { current: initialProps } = initialPropsRef

    if (initialProps.sdk && !initialProps.onStatesReady) {
      return
    }

    if (initialProps.sdk !== undefined) {
      const { sdk } = initialProps

      try {
        cleanupRef.current = getCleanup(sdk, initialProps.onStatesReady)
        sdkRef.current = sdk
        setState({ error: undefined, isReady: true, sdk })
      } catch (error: unknown) {
        const err = toError(error)
        logger.error('Failed to initialize SDK state subscriptions:', err.message)
        setState({ error: err, isReady: false, sdk: undefined })
      }

      return () => {
        destroyed = true
        dispose()
      }
    }

    const { children: _children, onStatesReady, sdk: _sdk, ...config } = initialProps

    void ContentfulOptimization.create(config)
      .then((sdk) => {
        if (destroyed) {
          sdk.destroy()
          return
        }

        try {
          cleanupRef.current = getCleanup(sdk, onStatesReady)
        } catch (error: unknown) {
          sdk.destroy()

          const err = toError(error)
          logger.error('Failed to initialize SDK state subscriptions:', err.message)
          setState({ error: err, isReady: false, sdk: undefined })
          return
        }

        logger.info('Provider initialized')
        ownsSdkRef.current = true
        sdkRef.current = sdk
        setState({ error: undefined, isReady: true, sdk })
      })
      .catch((error: unknown) => {
        if (destroyed) return

        const err = toError(error)
        logger.error('Failed to initialize SDK:', err.message)
        setState({ error: err, isReady: false, sdk: undefined })
      })

    return () => {
      destroyed = true
      dispose()
    }
  }, [])

  useEffect(() => {
    if (state.sdk === undefined || props.sdk !== undefined || liveLocale === undefined) {
      return
    }

    try {
      state.sdk.setLocale(liveLocale)
    } catch (error: unknown) {
      const err = toError(error)
      logger.error('Failed to update SDK locale:', err.message)
      setState({ error: err, isReady: true, sdk: state.sdk })
    }
  }, [liveLocale, props.sdk, state.sdk])

  const shouldRenderChildren = state.isReady || state.error !== undefined

  if (!shouldRenderChildren) {
    return null
  }

  return <OptimizationContext.Provider value={state}>{children}</OptimizationContext.Provider>
}

export default OptimizationProvider

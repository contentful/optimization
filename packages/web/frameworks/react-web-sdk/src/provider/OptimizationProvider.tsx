import ContentfulOptimization, { type OptimizationWebConfig } from '@contentful/optimization-web'
import { useEffect, useRef, type PropsWithChildren, type ReactElement } from 'react'

import { OptimizationContext, type OptimizationSdk } from '../context/OptimizationContext'

export type OptimizationProviderConfigProps = PropsWithChildren<
  OptimizationWebConfig & {
    readonly sdk?: never
  }
>

export type OptimizationProviderSdkProps = PropsWithChildren<{
  readonly sdk: OptimizationSdk
}>

export type OptimizationProviderProps =
  | OptimizationProviderConfigProps
  | OptimizationProviderSdkProps

export function OptimizationProvider(props: OptimizationProviderProps): ReactElement {
  const { children } = props
  const instanceRef = useRef<OptimizationSdk | null>(null)
  const errorRef = useRef<Error | null>(null)
  const ownsInstanceRef = useRef(false)

  if (props.sdk !== undefined) {
    const { sdk } = props

    instanceRef.current = sdk
    errorRef.current = null
    ownsInstanceRef.current = false
  } else if (instanceRef.current === null && errorRef.current === null) {
    const { children: _children, ...config } = props

    try {
      instanceRef.current = new ContentfulOptimization(config)
      ownsInstanceRef.current = true
    } catch (error) {
      errorRef.current = error instanceof Error ? error : new Error(String(error))
      ownsInstanceRef.current = false
    }
  }

  useEffect(
    () => () => {
      if (ownsInstanceRef.current) {
        instanceRef.current?.destroy()
      }
      instanceRef.current = null
    },
    [],
  )

  return (
    <OptimizationContext.Provider
      value={{
        sdk: instanceRef.current ?? undefined,
        isReady: instanceRef.current !== null,
        error: errorRef.current ?? undefined,
      }}
    >
      {children}
    </OptimizationContext.Provider>
  )
}

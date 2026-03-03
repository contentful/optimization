import Optimization, {
  type App,
  type CoreStatefulAnalyticsConfig,
  type CoreStatefulPersonalizationConfig,
  type LogLevels,
} from '@contentful/optimization-web'
import { useRef, type PropsWithChildren, type ReactElement } from 'react'

import { OptimizationContext } from '../context/OptimizationContext'

// TODO: we need to use the config type that should be export it from the web SDK
type AutoTrackEntryInteractionOptions = Partial<Record<'views' | 'clicks', boolean>>

// Config-based props (clientId required, rest optional)
export interface OptimizationProviderProps extends PropsWithChildren {
  clientId: string
  environment?: string
  analytics?: CoreStatefulAnalyticsConfig
  personalization?: CoreStatefulPersonalizationConfig
  app?: App
  autoTrackEntryInteraction?: AutoTrackEntryInteractionOptions
  logLevel?: LogLevels
}

export function OptimizationProvider(props: OptimizationProviderProps): ReactElement {
  const { children, ...config } = props
  const instanceRef = useRef<Optimization | null>(null)

  instanceRef.current ??= new Optimization(config)

  return (
    <OptimizationContext.Provider value={{ instance: instanceRef.current }}>
      {children}
    </OptimizationContext.Provider>
  )
}

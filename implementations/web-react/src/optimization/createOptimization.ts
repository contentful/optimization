import Optimization from '@contentful/optimization-web'

export type OptimizationInstance = Optimization
export type OptimizationConfig = ConstructorParameters<typeof Optimization>[0]

const OPTIMIZATION_CLIENT_ID =
  import.meta.env.PUBLIC_NINETAILED_CLIENT_ID?.trim() ?? 'mock-client-id'
const OPTIMIZATION_ENVIRONMENT = import.meta.env.PUBLIC_NINETAILED_ENVIRONMENT?.trim() ?? 'main'
const EXPERIENCE_API_BASE_URL =
  import.meta.env.PUBLIC_EXPERIENCE_API_BASE_URL?.trim() ?? 'http://localhost:8000/experience/'
const INSIGHTS_API_BASE_URL =
  import.meta.env.PUBLIC_INSIGHTS_API_BASE_URL?.trim() ?? 'http://localhost:8000/insights/'

function createOptimizationConfig(): OptimizationConfig {
  return {
    clientId: OPTIMIZATION_CLIENT_ID,
    environment: OPTIMIZATION_ENVIRONMENT,
    logLevel: 'debug',
    autoTrackEntryViews: true,
    app: {
      name: 'Optimization SDK - React Web Reference',
      version: '0.1.0',
    },
    analytics: {
      baseUrl: INSIGHTS_API_BASE_URL,
    },
    personalization: {
      baseUrl: EXPERIENCE_API_BASE_URL,
    },
  }
}

export function createOptimization(): OptimizationInstance {
  try {
    const config = createOptimizationConfig()
    return new Optimization(config)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Optimization init error'
    throw new Error(`Failed to initialize Optimization SDK: ${message}`)
  }
}

let optimizationInstance: OptimizationInstance | undefined = undefined

export function getOptimization(): OptimizationInstance {
  optimizationInstance ??= createOptimization()

  return optimizationInstance
}

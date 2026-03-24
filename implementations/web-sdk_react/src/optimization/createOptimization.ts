import ContentfulOptimization from '@contentful/optimization-web'

export type OptimizationInstance = ContentfulOptimization
export type OptimizationConfig = ConstructorParameters<typeof ContentfulOptimization>[0]

const OPTIMIZATION_CLIENT_ID =
  import.meta.env.PUBLIC_NINETAILED_CLIENT_ID?.trim() ?? 'mock-client-id'
const OPTIMIZATION_ENVIRONMENT = import.meta.env.PUBLIC_NINETAILED_ENVIRONMENT?.trim() ?? 'main'
const EXPERIENCE_API_BASE_URL =
  import.meta.env.PUBLIC_EXPERIENCE_API_BASE_URL?.trim() ?? 'http://localhost:8000/experience/'
const INSIGHTS_API_BASE_URL =
  import.meta.env.PUBLIC_INSIGHTS_API_BASE_URL?.trim() ?? 'http://localhost:8000/insights/'
const OPTIMIZATION_LOG_LEVEL = import.meta.env.PUBLIC_OPTIMIZATION_LOG_LEVEL?.trim().toLowerCase()
type OptimizationLogLevel = 'debug' | 'warn' | 'error'

function resolveLogLevel(): OptimizationLogLevel {
  if (OPTIMIZATION_LOG_LEVEL === 'debug') {
    return 'debug'
  }

  if (OPTIMIZATION_LOG_LEVEL === 'warn') {
    return 'warn'
  }

  if (OPTIMIZATION_LOG_LEVEL === 'error') {
    return 'error'
  }

  return import.meta.env.DEV ? 'debug' : 'warn'
}

class OptimizationInitializationError extends Error {
  public readonly cause: unknown

  public constructor(message: string, cause: unknown) {
    super(message)
    this.name = 'OptimizationInitializationError'
    this.cause = cause
  }
}

function createOptimizationConfig(): OptimizationConfig {
  return {
    clientId: OPTIMIZATION_CLIENT_ID,
    environment: OPTIMIZATION_ENVIRONMENT,
    logLevel: resolveLogLevel(),
    autoTrackEntryInteraction: { views: true, clicks: true, hovers: true },
    app: {
      name: 'ContentfulOptimization SDK - React Web Reference',
      version: '0.1.0',
    },
    api: {
      insightsBaseUrl: INSIGHTS_API_BASE_URL,
      experienceBaseUrl: EXPERIENCE_API_BASE_URL,
    },
  }
}

export function createOptimization(): OptimizationInstance {
  try {
    const config = createOptimizationConfig()
    return new ContentfulOptimization(config)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown ContentfulOptimization init error'
    throw new OptimizationInitializationError(
      `Failed to initialize ContentfulOptimization SDK: ${message}`,
      error,
    )
  }
}

let optimizationInstance: OptimizationInstance | undefined = undefined

export function getOptimization(): OptimizationInstance {
  // Keep a single process-wide instance for this reference implementation.
  optimizationInstance ??= createOptimization()

  return optimizationInstance
}

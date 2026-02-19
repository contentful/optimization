import Optimization from '@contentful/optimization-web'
import { ENV_CONFIG } from '../config/env'

export type OptimizationInstance = Optimization
export type OptimizationConfig = ConstructorParameters<typeof Optimization>[0]

function createOptimizationConfig(): OptimizationConfig {
  return {
    clientId: ENV_CONFIG.optimization.clientId,
    environment: ENV_CONFIG.optimization.environment,
    logLevel: 'debug',
    autoTrackEntryViews: false,
    app: {
      name: 'Optimization SDK - React Web Reference',
      version: '0.1.0',
    },
    analytics: {
      baseUrl: ENV_CONFIG.api.insightsBaseUrl,
    },
    personalization: {
      baseUrl: ENV_CONFIG.api.experienceBaseUrl,
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

const optimzationInstance = createOptimization()

export function getOptimization(): OptimizationInstance {
  return optimzationInstance
}

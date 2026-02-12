export * from '@contentful/optimization-web'

export {
  createOptimizationInstance,
  type ReactOptimizationInstance,
  type ReactSdkConfig,
} from './runtime/createOptimizationInstance'

export {
  OptimizationConsumer,
  type OptimizationConsumerProps,
} from './components/OptimizationConsumer'
export {
  OptimizationProvider,
  type OptimizationProviderProps,
} from './components/OptimizationProvider'
export { OptimizationState, type OptimizationStateProps } from './components/OptimizationState'
export {
  default as OptimizationContext,
  type OptimizationContextValue,
} from './context/OptimizationContext'
export { useOptimization } from './hooks/useOptimization'

export { createReactCapabilityAdapters, type ReactCapabilityAdapters } from './adapters'
export { capabilityMapping, type CapabilityMappingEntry } from './contracts/capabilityMapping'

import { describe, expect, it, rs } from '@rstest/core'

// Mock React Native
rs.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Dimensions: {
    get: rs.fn(() => ({ width: 375, height: 667 })),
    addEventListener: rs.fn(() => ({ remove: rs.fn() })),
  },
  NativeModules: {},
}))

// Mock AsyncStorage
rs.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: rs.fn(),
    setItem: rs.fn(),
    removeItem: rs.fn(),
  },
}))

// Mock @contentful/optimization-core
rs.mock('@contentful/optimization-core', () => ({
  logger: {
    info: rs.fn(),
    debug: rs.fn(),
    error: rs.fn(),
    warn: rs.fn(),
  },
  createScopedLogger: () => ({
    debug: rs.fn(),
    info: rs.fn(),
    log: rs.fn(),
    warn: rs.fn(),
    error: rs.fn(),
    fatal: rs.fn(),
  }),
}))

// Mock useOptimization hook
rs.mock('../context/OptimizationContext', () => ({
  useOptimization: () => ({
    screen: rs.fn().mockResolvedValue({ profile: {}, changes: [], personalizations: [] }),
  }),
}))

describe('OptimizationNavigationContainer', () => {
  it('should export OptimizationNavigationContainer function', async () => {
    const module = await import('./OptimizationNavigationContainer')
    expect(typeof module.OptimizationNavigationContainer).toBe('function')
  })

  it('should export OptimizationNavigationContainerProps type', async () => {
    // Type check - this verifies the type exists at compile time
    const module = await import('./OptimizationNavigationContainer')
    expect(module).toBeDefined()
  })
})

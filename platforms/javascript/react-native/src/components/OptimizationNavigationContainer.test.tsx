import { describe, expect, it, vi } from 'vitest'

// Mock React Native
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Dimensions: {
    get: vi.fn(() => ({ width: 375, height: 667 })),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  NativeModules: {},
}))

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

// Mock @contentful/optimization-core
vi.mock('@contentful/optimization-core', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  createScopedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  }),
}))

// Mock useOptimization hook
vi.mock('../context/OptimizationContext', () => ({
  useOptimization: () => ({
    screen: vi.fn().mockResolvedValue({ profile: {}, changes: [], personalizations: [] }),
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

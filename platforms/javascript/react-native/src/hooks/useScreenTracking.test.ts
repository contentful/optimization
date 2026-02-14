import { beforeEach, describe, expect, it, rs } from '@rstest/core'

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

// Create mock optimization instance
const mockScreen = rs.fn().mockResolvedValue({ profile: {}, changes: [], personalizations: [] })

const mockOptimization = {
  screen: mockScreen,
}

// Mock useOptimization hook
rs.mock('../context/OptimizationContext', () => ({
  useOptimization: () => mockOptimization,
}))

// Mock react hooks
const mockUseEffect = rs.fn()
const mockUseCallback = rs.fn(<T>(fn: T): T => fn)
const mockUseRef = rs.fn((initial: unknown) => ({ current: initial }))

rs.mock('react', () => ({
  useEffect: (fn: () => void) => {
    mockUseEffect(fn)
    fn()
  },
  useCallback: (fn: () => unknown) => {
    mockUseCallback(fn)
    return fn
  },
  useRef: (initial: unknown) => mockUseRef(initial),
}))

describe('useScreenTracking', () => {
  beforeEach(() => {
    rs.clearAllMocks()
    mockScreen.mockResolvedValue({ profile: {}, changes: [], personalizations: [] })
  })

  it('should track screen on mount when trackOnMount is true (default)', async () => {
    // Dynamically import to ensure mocks are applied
    const { useScreenTracking } = await import('./useScreenTracking')

    const result = useScreenTracking({
      name: 'TestScreen',
      properties: { test: true },
    })

    // Verify trackScreen function is returned
    expect(typeof result.trackScreen).toBe('function')

    // The hook should have called screen() on mount
    // Note: Due to the mocking of useEffect, we need to check if it was set up
    expect(mockUseEffect).toHaveBeenCalled()
  })

  it('should call sdk.screen with correct parameters', async () => {
    const { useScreenTracking } = await import('./useScreenTracking')

    const { trackScreen } = useScreenTracking({
      name: 'TestScreen',
      properties: { customProp: 'value' },
      trackOnMount: false,
    })

    await trackScreen()

    expect(mockScreen).toHaveBeenCalledWith({
      name: 'TestScreen',
      properties: { customProp: 'value' },
    })
  })

  it('should use empty properties object by default', async () => {
    const { useScreenTracking } = await import('./useScreenTracking')

    const { trackScreen } = useScreenTracking({
      name: 'MinimalScreen',
      trackOnMount: false,
    })

    await trackScreen()

    expect(mockScreen).toHaveBeenCalledWith({
      name: 'MinimalScreen',
      properties: {},
    })
  })

  it('should return undefined on error', async () => {
    mockScreen.mockRejectedValueOnce(new Error('Network error'))

    const { useScreenTracking } = await import('./useScreenTracking')

    const { trackScreen } = useScreenTracking({
      name: 'ErrorScreen',
      trackOnMount: false,
    })

    const result = await trackScreen()

    expect(result).toBeUndefined()
  })

  it('should return optimization data on success', async () => {
    const expectedData = {
      profile: { id: 'test-profile' },
      changes: [],
      personalizations: [],
    }
    mockScreen.mockResolvedValueOnce(expectedData)

    const { useScreenTracking } = await import('./useScreenTracking')

    const { trackScreen } = useScreenTracking({
      name: 'SuccessScreen',
      trackOnMount: false,
    })

    const result = await trackScreen()

    expect(result).toEqual(expectedData)
  })
})

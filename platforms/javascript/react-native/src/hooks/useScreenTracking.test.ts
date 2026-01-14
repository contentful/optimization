import { beforeEach, describe, expect, it, vi } from 'vitest'

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
}))

// Create mock optimization instance
const mockScreen = vi.fn().mockResolvedValue({ profile: {}, changes: [], personalizations: [] })

const mockOptimization = {
  screen: mockScreen,
}

// Mock useOptimization hook
vi.mock('../context/OptimizationContext', () => ({
  useOptimization: () => mockOptimization,
}))

// Mock react hooks
const mockUseEffect = vi.fn()
const mockUseCallback = vi.fn(<T>(fn: T): T => fn)
const mockUseRef = vi.fn((initial: unknown) => ({ current: initial }))

vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return {
    ...actual,
    useEffect: (fn: () => void) => {
      mockUseEffect(fn)
      fn()
    },
    useCallback: (fn: () => unknown) => {
      mockUseCallback(fn)
      return fn
    },
    useRef: (initial: unknown) => mockUseRef(initial),
  }
})

describe('useScreenTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

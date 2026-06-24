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

// Mock @contentful/optimization-core/logger
rs.mock('@contentful/optimization-core/logger', () => ({
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
interface MockScreenEmissionResult {
  readonly accepted: boolean
  readonly data?: unknown
}

const mockScreen = rs
  .fn<(payload: unknown) => Promise<MockScreenEmissionResult>>()
  .mockResolvedValue({
    accepted: true,
    data: { profile: {}, changes: [], selectedOptimizations: [] },
  })
const mockTrackCurrentScreen = rs
  .fn<(payload: unknown) => Promise<MockScreenEmissionResult>>()
  .mockResolvedValue({
    accepted: true,
    data: { profile: {}, changes: [], selectedOptimizations: [] },
  })
const mockHasConsent = rs.fn(() => true)
const mockConsentObservable = {
  current: undefined,
  subscribe: rs.fn((next: (value: boolean | undefined) => void) => {
    next(undefined)
    return { unsubscribe: rs.fn() }
  }),
}

const mockOptimization = {
  hasConsent: mockHasConsent,
  screen: async (payload: unknown) => await mockScreen(payload),
  states: {
    consent: mockConsentObservable,
  },
  trackCurrentScreen: async (payload: unknown) => await mockTrackCurrentScreen(payload),
}

// Mock useOptimization hook
rs.mock('../context/OptimizationContext', () => ({
  useOptimization: () => mockOptimization,
}))

// Mock react hooks
const mockUseEffect = rs.fn()
const mockUseCallback = rs.fn(<T>(fn: T): T => fn)
const mockUseRef = rs.fn((initial: unknown) => ({ current: initial }))
const mockUseState = rs.fn((initial: unknown) => [initial, rs.fn()])

rs.mock('react', () => ({
  useState: (initial: unknown) => mockUseState(initial),
  useEffect: (fn: () => void) => {
    mockUseEffect(fn)
    fn()
  },
  useCallback: (fn: () => unknown) => {
    mockUseCallback(fn)
    return fn
  },
  useRef: (initial: unknown) => mockUseRef(initial),
  useSyncExternalStore: (
    _subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => unknown,
  ) => getSnapshot(),
}))

describe('useScreenTracking', () => {
  beforeEach(() => {
    rs.clearAllMocks()
    mockHasConsent.mockReturnValue(true)
    mockScreen.mockResolvedValue({
      accepted: true,
      data: { profile: {}, changes: [], selectedOptimizations: [] },
    })
    mockTrackCurrentScreen.mockResolvedValue({
      accepted: true,
      data: { profile: {}, changes: [], selectedOptimizations: [] },
    })
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

    // The hook should have delegated automatic tracking on mount.
    // Note: Due to the mocking of useEffect, we need to check if it was set up
    expect(mockUseEffect).toHaveBeenCalled()
    expect(mockTrackCurrentScreen).toHaveBeenCalledWith({
      routeKey: 'TestScreen',
      name: 'TestScreen',
      properties: { test: true },
      screen: { name: 'TestScreen' },
    })
  })

  it('should call sdk screen with correct parameters for manual tracking', async () => {
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
      screen: { name: 'TestScreen' },
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
      screen: { name: 'MinimalScreen' },
    })
  })

  it('should return not accepted on error', async () => {
    mockScreen.mockRejectedValueOnce(new Error('Network error'))

    const { useScreenTracking } = await import('./useScreenTracking')

    const { trackScreen } = useScreenTracking({
      name: 'ErrorScreen',
      trackOnMount: false,
    })

    const result = await trackScreen()

    expect(result).toEqual({ accepted: false })
  })

  it('should return the emission result on success', async () => {
    const expectedData = {
      profile: { id: 'test-profile' },
      changes: [],
      selectedOptimizations: [],
    }
    mockScreen.mockResolvedValueOnce({
      accepted: true,
      data: expectedData,
    })

    const { useScreenTracking } = await import('./useScreenTracking')

    const { trackScreen } = useScreenTracking({
      name: 'SuccessScreen',
      trackOnMount: false,
    })

    const result = await trackScreen()

    expect(result).toEqual({ accepted: true, data: expectedData })
  })

  it('delegates automatic mount tracking to current-screen helper', async () => {
    const { useScreenTracking } = await import('./useScreenTracking')

    useScreenTracking({
      name: 'CurrentScreen',
    })

    expect(mockTrackCurrentScreen).toHaveBeenCalledWith({
      routeKey: 'CurrentScreen',
      name: 'CurrentScreen',
      properties: {},
      screen: { name: 'CurrentScreen' },
    })
    expect(mockScreen).not.toHaveBeenCalled()
  })
})

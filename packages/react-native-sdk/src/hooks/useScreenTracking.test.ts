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

const mockScreenWithEmissionResult = rs
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
  states: {
    consent: mockConsentObservable,
  },
}

rs.mock('@contentful/optimization-core/sdk-support', () => {
  class AcceptedCurrentStateTracker {
    async emitIfNeeded({
      emit,
      isAllowed,
    }: {
      emit: () => Promise<unknown>
      isAllowed: boolean
    }): Promise<unknown> {
      if (!isAllowed) return { accepted: false, attempted: false }

      return await emit()
    }
  }

  return {
    AcceptedCurrentStateTracker,
    screenWithEmissionResult: async (_sdk: unknown, payload: unknown) =>
      await mockScreenWithEmissionResult(payload),
  }
})

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
    mockScreenWithEmissionResult.mockResolvedValue({
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

    // The hook should have called screen() on mount
    // Note: Due to the mocking of useEffect, we need to check if it was set up
    expect(mockUseEffect).toHaveBeenCalled()
  })

  it('should call sdk screen emission helper with correct parameters', async () => {
    const { useScreenTracking } = await import('./useScreenTracking')

    const { trackScreen } = useScreenTracking({
      name: 'TestScreen',
      properties: { customProp: 'value' },
      trackOnMount: false,
    })

    await trackScreen()

    expect(mockScreenWithEmissionResult).toHaveBeenCalledWith({
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

    expect(mockScreenWithEmissionResult).toHaveBeenCalledWith({
      name: 'MinimalScreen',
      properties: {},
      screen: { name: 'MinimalScreen' },
    })
  })

  it('should return undefined on error', async () => {
    mockScreenWithEmissionResult.mockRejectedValueOnce(new Error('Network error'))

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
      selectedOptimizations: [],
    }
    mockScreenWithEmissionResult.mockResolvedValueOnce({
      accepted: true,
      data: expectedData,
    })

    const { useScreenTracking } = await import('./useScreenTracking')

    const { trackScreen } = useScreenTracking({
      name: 'SuccessScreen',
      trackOnMount: false,
    })

    const result = await trackScreen()

    expect(result).toEqual(expectedData)
  })

  it('should skip automatic mount tracking until screen tracking is allowed', async () => {
    mockHasConsent.mockReturnValue(false)

    const { useScreenTracking } = await import('./useScreenTracking')

    useScreenTracking({
      name: 'BlockedScreen',
    })

    expect(mockHasConsent).toHaveBeenCalledWith('screen')
    expect(mockScreenWithEmissionResult).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, rs } from '@rstest/core'
import type { UseScreenTrackingOptions, UseScreenTrackingReturn } from './useScreenTracking'

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

let consentSnapshot: boolean | undefined = undefined

rs.mock('./useOptimizationConsentState', () => ({
  useOptimizationConsentState: () => consentSnapshot,
}))

// Mock react hooks
type DependencyList = readonly unknown[] | undefined
type EffectCleanup = () => void
type EffectCallback = () => EffectCleanup | undefined

interface StoredCallback {
  readonly callback: unknown
  readonly deps: DependencyList
}

interface StoredEffect {
  cleanup?: EffectCleanup
  readonly deps: DependencyList
}

let hookIndex = 0
const callbackStates: StoredCallback[] = []
const effectStates: StoredEffect[] = []
const refStates: Array<{ current: unknown }> = []

function beginHookRender(): void {
  hookIndex = 0
}

function resetHookState(): void {
  hookIndex = 0
  callbackStates.length = 0
  effectStates.length = 0
  refStates.length = 0
}

function areHookInputsEqual(nextDeps: DependencyList, prevDeps: DependencyList): boolean {
  if (nextDeps === undefined || prevDeps === undefined) {
    return false
  }

  if (nextDeps.length !== prevDeps.length) {
    return false
  }

  return nextDeps.every((dependency, index) => Object.is(dependency, prevDeps[index]))
}

function renderUseScreenTracking(
  useScreenTracking: (options: UseScreenTrackingOptions) => UseScreenTrackingReturn,
  options: UseScreenTrackingOptions,
): UseScreenTrackingReturn {
  beginHookRender()
  return useScreenTracking(options)
}

const mockUseEffect = rs.fn((fn: EffectCallback, deps?: DependencyList) => {
  const effectIndex = hookIndex
  hookIndex += 1

  const previous = effectStates[effectIndex]
  if (previous !== undefined && areHookInputsEqual(deps, previous.deps)) {
    return
  }

  previous?.cleanup?.()
  const cleanup = fn()
  effectStates[effectIndex] = { cleanup, deps }
})
const mockUseCallback = rs.fn((fn: unknown, deps?: DependencyList): unknown => {
  const callbackIndex = hookIndex
  hookIndex += 1

  const previous = callbackStates[callbackIndex]
  if (previous !== undefined && areHookInputsEqual(deps, previous.deps)) {
    return previous.callback
  }

  callbackStates[callbackIndex] = { callback: fn, deps }
  return fn
})
const mockUseRef = rs.fn((initial: unknown): { current: unknown } => {
  const refIndex = hookIndex
  hookIndex += 1

  const previous = refStates[refIndex]
  if (previous !== undefined) {
    return previous
  }

  const ref = { current: initial }
  refStates[refIndex] = ref

  return ref
})
const mockUseState = rs.fn((initial: unknown) => {
  hookIndex += 1
  return [initial, rs.fn()]
})

rs.mock('react', () => ({
  useState: (initial: unknown) => mockUseState(initial),
  useEffect: (fn: EffectCallback, deps?: DependencyList) => {
    mockUseEffect(fn, deps)
  },
  useCallback: (fn: unknown, deps?: DependencyList) => mockUseCallback(fn, deps),
  useRef: (initial: unknown) => mockUseRef(initial),
  useSyncExternalStore: (
    _subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => unknown,
  ) => getSnapshot(),
}))

describe('useScreenTracking', () => {
  beforeEach(() => {
    rs.clearAllMocks()
    resetHookState()
    consentSnapshot = undefined
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

    const result = renderUseScreenTracking(useScreenTracking, {
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

    const { trackScreen } = renderUseScreenTracking(useScreenTracking, {
      name: 'TestScreen',
      properties: { customProp: 'value' },
      trackOnMount: false,
    })

    await trackScreen()

    expect(mockTrackCurrentScreen).not.toHaveBeenCalled()
    expect(mockScreen).toHaveBeenCalledWith({
      name: 'TestScreen',
      properties: { customProp: 'value' },
      screen: { name: 'TestScreen' },
    })
  })

  it('should use empty properties object by default', async () => {
    const { useScreenTracking } = await import('./useScreenTracking')

    const { trackScreen } = renderUseScreenTracking(useScreenTracking, {
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

    const { trackScreen } = renderUseScreenTracking(useScreenTracking, {
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

    const { trackScreen } = renderUseScreenTracking(useScreenTracking, {
      name: 'SuccessScreen',
      trackOnMount: false,
    })

    const result = await trackScreen()

    expect(result).toEqual({ accepted: true, data: expectedData })
  })

  it('delegates automatic mount tracking to current-screen helper', async () => {
    const { useScreenTracking } = await import('./useScreenTracking')

    renderUseScreenTracking(useScreenTracking, {
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

  it('re-runs automatic tracking with the current name when the supplied name changes', async () => {
    const { useScreenTracking } = await import('./useScreenTracking')
    const properties = { test: true }

    renderUseScreenTracking(useScreenTracking, {
      name: 'InitialScreen',
      properties,
    })
    renderUseScreenTracking(useScreenTracking, {
      name: 'UpdatedScreen',
      properties,
    })

    expect(mockTrackCurrentScreen).toHaveBeenNthCalledWith(1, {
      routeKey: 'InitialScreen',
      name: 'InitialScreen',
      properties,
      screen: { name: 'InitialScreen' },
    })
    expect(mockTrackCurrentScreen).toHaveBeenNthCalledWith(2, {
      routeKey: 'UpdatedScreen',
      name: 'UpdatedScreen',
      properties,
      screen: { name: 'UpdatedScreen' },
    })
  })

  it('keeps automatic tracking disabled while manual tracking uses the latest name', async () => {
    const { useScreenTracking } = await import('./useScreenTracking')
    const firstRender = renderUseScreenTracking(useScreenTracking, {
      name: 'InitialManualScreen',
      trackOnMount: false,
    })
    const secondRender = renderUseScreenTracking(useScreenTracking, {
      name: 'UpdatedManualScreen',
      properties: { step: 2 },
      trackOnMount: false,
    })

    expect(mockTrackCurrentScreen).not.toHaveBeenCalled()
    expect(secondRender.trackScreen).toBe(firstRender.trackScreen)

    await firstRender.trackScreen()

    expect(mockScreen).toHaveBeenCalledWith({
      name: 'UpdatedManualScreen',
      properties: { step: 2 },
      screen: { name: 'UpdatedManualScreen' },
    })
  })

  it('retries automatic tracking with the current name when consent changes', async () => {
    const { useScreenTracking } = await import('./useScreenTracking')

    consentSnapshot = false
    renderUseScreenTracking(useScreenTracking, {
      name: 'ConsentScreen',
    })

    mockTrackCurrentScreen.mockClear()
    consentSnapshot = true
    renderUseScreenTracking(useScreenTracking, {
      name: 'ConsentScreen',
    })

    expect(mockTrackCurrentScreen).toHaveBeenCalledTimes(1)
    expect(mockTrackCurrentScreen).toHaveBeenCalledWith({
      routeKey: 'ConsentScreen',
      name: 'ConsentScreen',
      properties: {},
      screen: { name: 'ConsentScreen' },
    })
  })
})

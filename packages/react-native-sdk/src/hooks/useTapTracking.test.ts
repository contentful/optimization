import { beforeEach, describe, expect, it, rs } from '@rstest/core'
import type { Entry } from 'contentful'
import type { GestureResponderEvent } from 'react-native'

rs.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Dimensions: {
    get: rs.fn(() => ({ width: 375, height: 667 })),
    addEventListener: rs.fn(() => ({ remove: rs.fn() })),
  },
  AppState: {
    addEventListener: rs.fn(() => ({ remove: rs.fn() })),
  },
  NativeModules: {},
}))

rs.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: rs.fn(),
    setItem: rs.fn(),
    removeItem: rs.fn(),
  },
}))

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

rs.mock('../context/OptimizationScrollContext', () => ({
  useScrollContext: () => null,
}))

const mockTrackClick = rs.fn().mockResolvedValue(undefined)
const mockHasConsent = rs.fn(() => true)
const mockConsentObservable = {
  current: undefined,
  subscribe: rs.fn((next: (value: boolean | undefined) => void) => {
    next(undefined)
    return { unsubscribe: rs.fn() }
  }),
}

rs.mock('../context/OptimizationContext', () => ({
  useOptimization: () => ({
    hasConsent: mockHasConsent,
    states: {
      consent: mockConsentObservable,
    },
    trackClick: mockTrackClick,
  }),
}))

rs.mock('react', () => ({
  useState: (initial: unknown) => [initial, rs.fn()],
  useEffect: (fn: () => undefined | (() => void)) => {
    fn()
  },
  useCallback: <T>(fn: T): T => fn,
  useRef: (initial: unknown) => ({ current: initial }),
}))

function createMockEntry(id: string): Entry {
  return {
    // @ts-expect-error -- partial mock for testing, missing publishedVersion
    sys: {
      id,
      type: 'Entry',
      contentType: { sys: { id: 'testType', type: 'Link', linkType: 'ContentType' } },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      environment: { sys: { id: 'master', type: 'Link', linkType: 'Environment' } },
      space: { sys: { id: 'space1', type: 'Link', linkType: 'Space' } },
      revision: 1,
      locale: 'en-US',
    },
    fields: { title: 'Test Entry' },
    metadata: { tags: [] },
  }
}

function createTouchEvent(pageX: number, pageY: number): GestureResponderEvent {
  return {
    // @ts-expect-error -- partial native touch event mock for testing
    nativeEvent: {
      pageX,
      pageY,
    },
  }
}

describe('useTapTracking', () => {
  beforeEach(() => {
    rs.clearAllMocks()
    mockHasConsent.mockReturnValue(true)
  })

  it('should track tap payloads when trackClick is allowed', async () => {
    const { useTapTracking } = await import('./useTapTracking')
    const entry = createMockEntry('entry-clickable')
    const onTap = rs.fn()

    const { onTouchStart, onTouchEnd } = useTapTracking({
      entry,
      enabled: true,
      onTap,
    })

    onTouchStart?.(createTouchEvent(10, 10))
    onTouchEnd?.(createTouchEvent(11, 11))

    expect(mockTrackClick).toHaveBeenCalledWith({
      componentId: 'entry-clickable',
      experienceId: undefined,
      variantIndex: 0,
    })
    expect(onTap).toHaveBeenCalledWith(entry)
  })

  it('should forward optimizationContextId when provided', async () => {
    const { useTapTracking } = await import('./useTapTracking')
    const entry = createMockEntry('entry-clickable')

    const { onTouchStart, onTouchEnd } = useTapTracking({
      entry,
      enabled: true,
      optimizationContextId: 'ctx-tap',
    })

    onTouchStart?.(createTouchEvent(10, 10))
    onTouchEnd?.(createTouchEvent(11, 11))

    expect(mockTrackClick).toHaveBeenCalledWith({
      componentId: 'entry-clickable',
      experienceId: undefined,
      optimizationContextId: 'ctx-tap',
      variantIndex: 0,
    })
  })

  it('should skip click payloads before trackClick is allowed but still invoke onTap', async () => {
    mockHasConsent.mockReturnValue(false)
    const { useTapTracking } = await import('./useTapTracking')
    const entry = createMockEntry('entry-blocked')
    const onTap = rs.fn()

    const { onTouchStart, onTouchEnd } = useTapTracking({
      entry,
      enabled: true,
      onTap,
    })

    onTouchStart?.(createTouchEvent(20, 20))
    onTouchEnd?.(createTouchEvent(20, 20))

    expect(mockHasConsent).toHaveBeenCalledWith('trackClick')
    expect(mockTrackClick).not.toHaveBeenCalled()
    expect(onTap).toHaveBeenCalledWith(entry)
  })
})

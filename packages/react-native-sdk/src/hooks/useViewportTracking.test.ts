import type { SelectedPersonalization } from '@contentful/optimization-core/api-schemas'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import type { Entry } from 'contentful'
import type { LayoutChangeEvent } from 'react-native'

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

const mockTrackView = rs.fn().mockResolvedValue(undefined)

const mockOptimization = {
  trackView: mockTrackView,
}

rs.mock('../context/OptimizationContext', () => ({
  useOptimization: () => mockOptimization,
}))

let scrollContextValue: { scrollY: number; viewportHeight: number } | null = null

rs.mock('../context/OptimizationScrollContext', () => ({
  useScrollContext: () => scrollContextValue,
}))

type EffectFn = () => undefined | (() => void)
type CallbackFn = (...args: unknown[]) => unknown

const effects: EffectFn[] = []

const refs = new Map<number, { current: unknown }>()
let refCounter = 0

rs.mock('react', () => ({
  useState: (initial: unknown) => [initial, rs.fn()],
  useEffect: (fn: EffectFn) => {
    effects.push(fn)
    fn()
  },
  useCallback: (fn: CallbackFn) => fn,
  useRef: (initial: unknown) => {
    const id = refCounter++
    if (!refs.has(id)) {
      refs.set(id, { current: initial })
    }
    const ref = refs.get(id)
    if (!ref) throw new Error('ref not found')
    return ref
  },
}))

function resetHookState(): void {
  effects.length = 0
  refs.clear()
  refCounter = 0
}

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

function createLayoutEvent(): LayoutChangeEvent {
  // @ts-expect-error -- partial mock for testing
  return {
    nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 100 } },
  }
}

function getCallArg(callIndex: number): Record<string, unknown> {
  const result: Record<string, unknown> = mockTrackView.mock.calls[callIndex]?.[0]
  return result
}

describe('useViewportTracking', () => {
  beforeEach(() => {
    rs.clearAllMocks()
    resetHookState()
    scrollContextValue = { scrollY: 0, viewportHeight: 800 }
    rs.useFakeTimers()
  })

  afterEach(() => {
    rs.useRealTimers()
  })

  describe('initial event after dwell threshold', () => {
    it('should fire initial trackView after viewTimeMs of accumulated visible time', async () => {
      const { useViewportTracking } = await import('./useViewportTracking')
      const entry = createMockEntry('entry-1')

      const { onLayout } = useViewportTracking({
        entry,
        viewTimeMs: 2000,
        threshold: 0.5,
      })

      onLayout(createLayoutEvent())

      expect(mockTrackView).not.toHaveBeenCalled()

      rs.advanceTimersByTime(2000)

      expect(mockTrackView).toHaveBeenCalledTimes(1)
      const call = getCallArg(0)
      expect(call.componentId).toBe('entry-1')
      expect(call.viewDurationMs).toBeGreaterThanOrEqual(2000)
      expect(call.viewId).toBeDefined()
      expect(typeof call.viewId).toBe('string')
    })

    it('should not fire if visibility ends before dwell threshold', async () => {
      const { useViewportTracking } = await import('./useViewportTracking')
      const entry = createMockEntry('entry-2')

      useViewportTracking({
        entry,
        viewTimeMs: 2000,
        threshold: 0.8,
      })

      expect(mockTrackView).not.toHaveBeenCalled()

      rs.advanceTimersByTime(3000)

      expect(mockTrackView).not.toHaveBeenCalled()
    })
  })

  describe('periodic event scheduling', () => {
    it('should fire periodic events at viewDurationUpdateIntervalMs after initial event', async () => {
      const { useViewportTracking } = await import('./useViewportTracking')
      const entry = createMockEntry('entry-3')

      const { onLayout } = useViewportTracking({
        entry,
        viewTimeMs: 1000,
        viewDurationUpdateIntervalMs: 2000,
        threshold: 0.5,
      })

      onLayout(createLayoutEvent())

      rs.advanceTimersByTime(1000)
      expect(mockTrackView).toHaveBeenCalledTimes(1)

      rs.advanceTimersByTime(2000)
      expect(mockTrackView).toHaveBeenCalledTimes(2)

      rs.advanceTimersByTime(2000)
      expect(mockTrackView).toHaveBeenCalledTimes(3)
    })

    it('should send increasing viewDurationMs with each periodic event', async () => {
      const { useViewportTracking } = await import('./useViewportTracking')
      const entry = createMockEntry('entry-4')

      const { onLayout } = useViewportTracking({
        entry,
        viewTimeMs: 1000,
        viewDurationUpdateIntervalMs: 2000,
        threshold: 0.5,
      })

      onLayout(createLayoutEvent())

      rs.advanceTimersByTime(1000)
      const firstDuration = Number(getCallArg(0).viewDurationMs)

      rs.advanceTimersByTime(2000)
      const secondDuration = Number(getCallArg(1).viewDurationMs)

      expect(secondDuration).toBeGreaterThan(firstDuration)
    })
  })

  describe('viewId lifecycle', () => {
    it('should use the same viewId for all events within a visibility cycle', async () => {
      const { useViewportTracking } = await import('./useViewportTracking')
      const entry = createMockEntry('entry-5')

      const { onLayout } = useViewportTracking({
        entry,
        viewTimeMs: 1000,
        viewDurationUpdateIntervalMs: 2000,
        threshold: 0.5,
      })

      onLayout(createLayoutEvent())

      rs.advanceTimersByTime(1000)
      rs.advanceTimersByTime(2000)

      const firstViewId = getCallArg(0).viewId
      const secondViewId = getCallArg(1).viewId

      expect(firstViewId).toBe(secondViewId)
    })
  })

  describe('real accumulated viewDurationMs', () => {
    it('should send real accumulated duration instead of configured viewTimeMs', async () => {
      const { useViewportTracking } = await import('./useViewportTracking')
      const entry = createMockEntry('entry-6')

      const { onLayout } = useViewportTracking({
        entry,
        viewTimeMs: 1000,
        viewDurationUpdateIntervalMs: 5000,
        threshold: 0.5,
      })

      onLayout(createLayoutEvent())

      rs.advanceTimersByTime(1000)

      const call = getCallArg(0)
      expect(call.viewDurationMs).toBeGreaterThanOrEqual(1000)
      expect(typeof call.viewDurationMs).toBe('number')
    })
  })

  describe('metadata extraction', () => {
    it('should use entry.sys.id as componentId for baseline entries', async () => {
      const { useViewportTracking } = await import('./useViewportTracking')
      const entry = createMockEntry('baseline-123')

      const { onLayout } = useViewportTracking({
        entry,
        viewTimeMs: 100,
        threshold: 0.5,
      })

      onLayout(createLayoutEvent())

      rs.advanceTimersByTime(100)

      const call = getCallArg(0)
      expect(call.componentId).toBe('baseline-123')
      expect(call.experienceId).toBeUndefined()
      expect(call.variantIndex).toBe(0)
    })

    it('should use personalization metadata when provided', async () => {
      const { useViewportTracking } = await import('./useViewportTracking')
      const entry = createMockEntry('variant-456')

      const personalization: SelectedPersonalization = {
        experienceId: 'exp-1',
        variantIndex: 2,
        variants: { 'comp-base': 'variant-456' },
      }
      const { onLayout } = useViewportTracking({
        entry,
        personalization,
        viewTimeMs: 100,
        threshold: 0.5,
      })

      onLayout(createLayoutEvent())

      rs.advanceTimersByTime(100)

      const call = getCallArg(0)
      expect(call.componentId).toBe('comp-base')
      expect(call.experienceId).toBe('exp-1')
      expect(call.variantIndex).toBe(2)
    })
  })

  describe('default options', () => {
    it('should default threshold to 0.8, viewTimeMs to 2000, viewDurationUpdateIntervalMs to 5000', async () => {
      const { useViewportTracking } = await import('./useViewportTracking')
      const entry = createMockEntry('defaults-test')

      const { onLayout } = useViewportTracking({ entry })

      onLayout(createLayoutEvent())

      rs.advanceTimersByTime(1999)
      expect(mockTrackView).not.toHaveBeenCalled()

      rs.advanceTimersByTime(1)
      expect(mockTrackView).toHaveBeenCalledTimes(1)

      rs.advanceTimersByTime(5000)
      expect(mockTrackView).toHaveBeenCalledTimes(2)
    })
  })

  describe('return value', () => {
    it('should return isVisible and onLayout', async () => {
      const { useViewportTracking } = await import('./useViewportTracking')
      const entry = createMockEntry('return-test')

      const result = useViewportTracking({ entry })

      expect(result).toHaveProperty('isVisible')
      expect(result).toHaveProperty('onLayout')
      expect(typeof result.onLayout).toBe('function')
      expect(typeof result.isVisible).toBe('boolean')
    })
  })
})

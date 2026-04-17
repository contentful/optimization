import type {
  OptimizationData,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { signal } from '@preact/signals-core'
import { PreviewOverrideManager, type StateInterceptorRegistry } from './PreviewOverrideManager'

// ---------------------------------------------------------------------------
// Test data & helpers
// ---------------------------------------------------------------------------

const BASELINE: SelectedOptimizationArray = [
  { experienceId: 'exp-1', variantIndex: 1, variants: { b1: 'v1' }, sticky: false },
  { experienceId: 'exp-2', variantIndex: 2, variants: { b2: 'v2' }, sticky: false },
  { experienceId: 'exp-3', variantIndex: 0, variants: {}, sticky: false },
]

function makeOptimizationData(so: SelectedOptimizationArray): OptimizationData {
  return {
    profile: {
      id: 'p1',
      stableId: 'p1',
      random: 0.5,
      audiences: [],
      traits: {},
      location: {},
      session: {
        id: 's1',
        isReturningVisitor: false,
        count: 1,
        activeSessionLength: 0,
        averageSessionLength: 0,
        landingPage: {
          url: 'https://example.test/',
          referrer: '',
          query: {},
          search: '',
          path: '/',
          title: '',
        },
      },
    },
    selectedOptimizations: so,
    changes: [],
  }
}

type InterceptorFn = (
  data: Readonly<OptimizationData>,
) => OptimizationData | Promise<OptimizationData>

let selectedOptimizations: ReturnType<typeof signal<SelectedOptimizationArray | undefined>>
let stateInterceptors: StateInterceptorRegistry<OptimizationData>
let onOverridesChanged: ReturnType<typeof rs.fn>
let capturedInterceptor: InterceptorFn | undefined
let manager: PreviewOverrideManager | undefined

function createManager(): PreviewOverrideManager {
  selectedOptimizations = signal<SelectedOptimizationArray | undefined>(BASELINE)
  capturedInterceptor = undefined
  stateInterceptors = {
    add: rs.fn((fn: InterceptorFn) => {
      capturedInterceptor = fn
      return 42
    }),
    remove: rs.fn(() => true),
  }
  onOverridesChanged = rs.fn()
  manager = new PreviewOverrideManager({
    selectedOptimizations,
    stateInterceptors,
    onOverridesChanged,
  })
  return manager
}

function invokeInterceptor(): InterceptorFn {
  if (!capturedInterceptor) throw new Error('Interceptor not captured')
  return capturedInterceptor
}

function sv(): SelectedOptimizationArray {
  const v = selectedOptimizations.value
  if (!v) throw new Error('Signal value is unexpectedly undefined')
  return v
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PreviewOverrideManager', () => {
  afterEach(() => {
    manager?.destroy()
    manager = undefined
  })

  describe('constructor', () => {
    it('captures initial signal value as baseline when signal has data', () => {
      const mgr = createManager()
      expect(mgr.getBaselineSelectedOptimizations()).toEqual(BASELINE)
    })

    it('leaves baseline null when initial signal is undefined', () => {
      const sig = signal<SelectedOptimizationArray | undefined>(undefined)
      const interceptors: StateInterceptorRegistry<OptimizationData> = {
        add: rs.fn(() => 99),
        remove: rs.fn(() => true),
      }
      const mgr = new PreviewOverrideManager({
        selectedOptimizations: sig,
        stateInterceptors: interceptors,
      })
      expect(mgr.getBaselineSelectedOptimizations()).toBeNull()
      mgr.destroy()
    })

    it('registers a state interceptor and starts with empty overrides', () => {
      const mgr = createManager()
      expect(stateInterceptors.add).toHaveBeenCalledTimes(1)
      expect(mgr.getOverrides()).toEqual({ audiences: {}, selectedOptimizations: {} })
      expect(onOverridesChanged).not.toHaveBeenCalled()
    })
  })

  describe('activateAudience', () => {
    it('sets variant index 1 for all provided experience IDs', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-1', ['exp-1', 'exp-2'])
      const overrides = mgr.getOverrides()
      expect(overrides.audiences['aud-1']).toEqual({
        audienceId: 'aud-1',
        isActive: true,
        source: 'manual',
        experienceIds: ['exp-1', 'exp-2'],
      })
      expect(overrides.selectedOptimizations['exp-1']).toEqual({
        experienceId: 'exp-1',
        variantIndex: 1,
      })
      expect(overrides.selectedOptimizations['exp-2']).toEqual({
        experienceId: 'exp-2',
        variantIndex: 1,
      })
      expect(sv().find((s) => s.experienceId === 'exp-1')?.variantIndex).toBe(1)
      expect(sv().find((s) => s.experienceId === 'exp-2')?.variantIndex).toBe(1)
    })

    it('appends entries for experiences NOT in the API baseline', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-new', ['exp-99', 'exp-100'])
      expect(sv()).toHaveLength(BASELINE.length + 2)
      expect(sv().find((s) => s.experienceId === 'exp-99')).toEqual({
        experienceId: 'exp-99',
        variantIndex: 1,
        variants: {},
      })
      expect(sv().find((s) => s.experienceId === 'exp-100')).toEqual({
        experienceId: 'exp-100',
        variantIndex: 1,
        variants: {},
      })
    })

    it('with empty experience list records audience but does not sync signal', () => {
      const mgr = createManager()
      const original = selectedOptimizations.value
      mgr.activateAudience('aud-empty', [])
      expect(mgr.getOverrides().audiences['aud-empty']).toEqual({
        audienceId: 'aud-empty',
        isActive: true,
        source: 'manual',
        experienceIds: [],
      })
      expect(selectedOptimizations.value).toBe(original)
      expect(onOverridesChanged).toHaveBeenCalledTimes(1)
    })

    it('invokes onOverridesChanged with updated state', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-1', ['exp-1'])
      expect(onOverridesChanged).toHaveBeenCalledTimes(1)
      expect(onOverridesChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          audiences: expect.objectContaining({
            'aud-1': expect.objectContaining({ isActive: true }),
          }),
        }),
      )
    })
  })

  describe('deactivateAudience', () => {
    it('sets variant index 0 (baseline) for all provided experience IDs', () => {
      const mgr = createManager()
      mgr.deactivateAudience('aud-1', ['exp-1', 'exp-2'])
      const overrides = mgr.getOverrides()
      expect(overrides.audiences['aud-1']).toEqual({
        audienceId: 'aud-1',
        isActive: false,
        source: 'manual',
        experienceIds: ['exp-1', 'exp-2'],
      })
      expect(overrides.selectedOptimizations['exp-1']?.variantIndex).toBe(0)
      expect(overrides.selectedOptimizations['exp-2']?.variantIndex).toBe(0)
      expect(sv().find((s) => s.experienceId === 'exp-1')?.variantIndex).toBe(0)
      expect(sv().find((s) => s.experienceId === 'exp-2')?.variantIndex).toBe(0)
    })

    it('with empty experience list records audience as inactive without syncing signal', () => {
      const mgr = createManager()
      const original = selectedOptimizations.value
      mgr.deactivateAudience('aud-empty', [])
      expect(mgr.getOverrides().audiences['aud-empty']?.isActive).toBe(false)
      expect(selectedOptimizations.value).toBe(original)
      expect(onOverridesChanged).toHaveBeenCalledTimes(1)
    })
  })

  describe('setVariantOverride', () => {
    it('overrides an existing baseline experience variant', () => {
      const mgr = createManager()
      mgr.setVariantOverride('exp-1', 3)
      expect(mgr.getOverrides().selectedOptimizations['exp-1']).toEqual({
        experienceId: 'exp-1',
        variantIndex: 3,
      })
      expect(sv().find((s) => s.experienceId === 'exp-1')?.variantIndex).toBe(3)
      expect(sv().find((s) => s.experienceId === 'exp-2')?.variantIndex).toBe(2)
      expect(sv().find((s) => s.experienceId === 'exp-3')?.variantIndex).toBe(0)
      // baseline itself not mutated
      expect(
        mgr.getBaselineSelectedOptimizations()?.find((s) => s.experienceId === 'exp-1')
          ?.variantIndex,
      ).toBe(1)
    })

    it('appends entry for experience not in baseline', () => {
      const mgr = createManager()
      mgr.setVariantOverride('exp-new', 2)
      expect(sv()).toHaveLength(BASELINE.length + 1)
      expect(sv().find((s) => s.experienceId === 'exp-new')).toEqual({
        experienceId: 'exp-new',
        variantIndex: 2,
        variants: {},
      })
    })

    it('multiple sequential overrides accumulate and can be overwritten', () => {
      const mgr = createManager()
      mgr.setVariantOverride('exp-1', 3)
      mgr.setVariantOverride('exp-2', 5)
      expect(mgr.getOverrides().selectedOptimizations['exp-1']?.variantIndex).toBe(3)
      expect(mgr.getOverrides().selectedOptimizations['exp-2']?.variantIndex).toBe(5)
      mgr.setVariantOverride('exp-1', 7)
      expect(mgr.getOverrides().selectedOptimizations['exp-1']?.variantIndex).toBe(7)
      expect(sv().find((s) => s.experienceId === 'exp-1')?.variantIndex).toBe(7)
      expect(onOverridesChanged).toHaveBeenCalledTimes(3)
    })

    it('derives signal from baseline, not from stale signal value', () => {
      const mgr = createManager()
      mgr.setVariantOverride('exp-1', 3)
      selectedOptimizations.value = []
      mgr.setVariantOverride('exp-2', 5)
      expect(sv().length).toBeGreaterThanOrEqual(BASELINE.length)
      expect(sv().find((s) => s.experienceId === 'exp-1')?.variantIndex).toBe(3)
      expect(sv().find((s) => s.experienceId === 'exp-2')?.variantIndex).toBe(5)
      expect(sv().find((s) => s.experienceId === 'exp-3')?.variantIndex).toBe(0)
    })
  })

  describe('resetOptimizationOverride', () => {
    it('removes a single experience override and recomputes signal from baseline', () => {
      const mgr = createManager()
      mgr.setVariantOverride('exp-1', 3)
      mgr.setVariantOverride('exp-2', 5)
      mgr.resetOptimizationOverride('exp-1')
      expect(mgr.getOverrides().selectedOptimizations['exp-1']).toBeUndefined()
      expect(mgr.getOverrides().selectedOptimizations['exp-2']?.variantIndex).toBe(5)
      expect(sv().find((s) => s.experienceId === 'exp-1')?.variantIndex).toBe(1)
      expect(sv().find((s) => s.experienceId === 'exp-2')?.variantIndex).toBe(5)
    })

    it('resetting a non-existent override is a no-op (does not throw)', () => {
      const mgr = createManager()
      expect(() => {
        mgr.resetOptimizationOverride('nonexistent')
      }).not.toThrow()
      expect(onOverridesChanged).toHaveBeenCalledTimes(1)
    })
  })

  describe('resetAudienceOverride', () => {
    it('removes audience and all its associated experience overrides', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-1', ['exp-1', 'exp-2'])
      mgr.resetAudienceOverride('aud-1')
      expect(mgr.getOverrides()).toEqual({ audiences: {}, selectedOptimizations: {} })
      expect(sv().find((s) => s.experienceId === 'exp-1')?.variantIndex).toBe(1)
      expect(sv().find((s) => s.experienceId === 'exp-2')?.variantIndex).toBe(2)
    })

    it('only removes experiences belonging to the reset audience, preserves others', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-1', ['exp-1'])
      mgr.setVariantOverride('exp-2', 5)
      mgr.resetAudienceOverride('aud-1')
      expect(mgr.getOverrides().selectedOptimizations['exp-1']).toBeUndefined()
      expect(mgr.getOverrides().selectedOptimizations['exp-2']?.variantIndex).toBe(5)
      expect(mgr.getOverrides().audiences['aud-1']).toBeUndefined()
    })

    it('resetting audience with no stored experience IDs still notifies', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-empty', [])
      onOverridesChanged.mockClear()
      mgr.resetAudienceOverride('aud-empty')
      expect(onOverridesChanged).toHaveBeenCalledTimes(1)
      expect(mgr.getOverrides().audiences).toEqual({})
    })

    it('resetting a non-existent audience is safe', () => {
      const mgr = createManager()
      expect(() => {
        mgr.resetAudienceOverride('nonexistent')
      }).not.toThrow()
      expect(onOverridesChanged).toHaveBeenCalledTimes(1)
    })
  })

  describe('resetAll', () => {
    it('clears all overrides and restores signal to baseline', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-1', ['exp-1'])
      mgr.setVariantOverride('exp-2', 5)
      mgr.resetAll()
      expect(mgr.getOverrides()).toEqual({ audiences: {}, selectedOptimizations: {} })
      expect(selectedOptimizations.value).toEqual(BASELINE)
    })

    it('handles resetAll when baseline is null (signal initially undefined)', () => {
      const sig = signal<SelectedOptimizationArray | undefined>(undefined)
      const interceptors: StateInterceptorRegistry<OptimizationData> = {
        add: rs.fn(() => 99),
        remove: rs.fn(() => true),
      }
      const mgr = new PreviewOverrideManager({
        selectedOptimizations: sig,
        stateInterceptors: interceptors,
      })
      mgr.setVariantOverride('exp-1', 1)
      expect(() => {
        mgr.resetAll()
      }).not.toThrow()
      expect(mgr.getOverrides()).toEqual({ audiences: {}, selectedOptimizations: {} })
      mgr.destroy()
    })
  })

  describe('destroy', () => {
    it('removes the state interceptor and clears all internal state', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-1', ['exp-1'])
      onOverridesChanged.mockClear()
      mgr.destroy()
      expect(stateInterceptors.remove).toHaveBeenCalledTimes(1)
      expect(stateInterceptors.remove).toHaveBeenCalledWith(42)
      expect(mgr.getOverrides()).toEqual({ audiences: {}, selectedOptimizations: {} })
      expect(mgr.getBaselineSelectedOptimizations()).toBeNull()
      expect(onOverridesChanged).not.toHaveBeenCalled()
    })

    it('calling destroy twice does not call remove twice', () => {
      const mgr = createManager()
      mgr.destroy()
      mgr.destroy()
      expect(stateInterceptors.remove).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // State interceptor (API refresh)
  // -------------------------------------------------------------------------
  describe('state interceptor (API refresh)', () => {
    const NEW_API: SelectedOptimizationArray = [
      { experienceId: 'exp-1', variantIndex: 1, variants: { b1: 'v1' }, sticky: false },
      { experienceId: 'exp-2', variantIndex: 2, variants: { b2: 'v2' }, sticky: false },
      { experienceId: 'exp-4', variantIndex: 0, variants: { b4: 'v4' }, sticky: false },
    ]

    it('caches incoming API data as new baseline', () => {
      const mgr = createManager()
      invokeInterceptor()(makeOptimizationData(NEW_API))
      expect(mgr.getBaselineSelectedOptimizations()).toEqual(NEW_API)
    })

    it('passes through unchanged when no overrides are active', async () => {
      createManager()
      const input = makeOptimizationData(NEW_API)
      const result = await invokeInterceptor()(input)
      expect(result).not.toBe(input)
      expect(result.selectedOptimizations).toBe(input.selectedOptimizations)
    })

    it('merges active overrides into incoming API data', async () => {
      const mgr = createManager()
      mgr.setVariantOverride('exp-1', 7)
      const result = await invokeInterceptor()(makeOptimizationData(NEW_API))
      expect(
        result.selectedOptimizations.find((s) => s.experienceId === 'exp-1')?.variantIndex,
      ).toBe(7)
      expect(
        result.selectedOptimizations.find((s) => s.experienceId === 'exp-2')?.variantIndex,
      ).toBe(2)
    })

    it('appends overridden experiences not in API data', async () => {
      const mgr = createManager()
      mgr.setVariantOverride('exp-new', 3)
      const result = await invokeInterceptor()(makeOptimizationData(NEW_API))
      expect(result.selectedOptimizations).toHaveLength(NEW_API.length + 1)
      expect(result.selectedOptimizations.find((s) => s.experienceId === 'exp-new')).toEqual({
        experienceId: 'exp-new',
        variantIndex: 3,
        variants: {},
      })
    })

    it('updates baseline so future resets use fresh API data', () => {
      const mgr = createManager()
      mgr.setVariantOverride('exp-1', 7)
      invokeInterceptor()(makeOptimizationData(NEW_API))
      mgr.resetAll()
      expect(selectedOptimizations.value).toEqual(NEW_API)
    })
  })

  // -------------------------------------------------------------------------
  // Real-world scenarios
  // -------------------------------------------------------------------------
  describe('real-world scenarios', () => {
    it('selecting experiences for an audience the user does not qualify for', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-X', ['exp-99', 'exp-100'])
      expect(sv()).toHaveLength(BASELINE.length + 2)
      expect(sv().find((s) => s.experienceId === 'exp-99')).toEqual({
        experienceId: 'exp-99',
        variantIndex: 1,
        variants: {},
      })
      expect(sv().find((s) => s.experienceId === 'exp-100')).toEqual({
        experienceId: 'exp-100',
        variantIndex: 1,
        variants: {},
      })
      expect(mgr.getOverrides().audiences['aud-X'].isActive).toBe(true)
      expect(mgr.getBaselineSelectedOptimizations()).toEqual(BASELINE)
    })

    it('user removes themselves from a selected experience', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-X', ['exp-99'])
      expect(sv().find((s) => s.experienceId === 'exp-99')).toBeDefined()
      mgr.resetAudienceOverride('aud-X')
      expect(sv()).toHaveLength(BASELINE.length)
      expect(sv().find((s) => s.experienceId === 'exp-99')).toBeUndefined()
      expect(mgr.getOverrides()).toEqual({ audiences: {}, selectedOptimizations: {} })
    })

    it('API refresh arrives while overrides are active', async () => {
      const mgr = createManager()
      mgr.setVariantOverride('exp-1', 5)
      const fresh: SelectedOptimizationArray = [
        { experienceId: 'exp-1', variantIndex: 1, variants: { b1: 'v1' }, sticky: false },
        { experienceId: 'exp-2', variantIndex: 2, variants: { b2: 'v2' }, sticky: false },
        { experienceId: 'exp-4', variantIndex: 0, variants: { b4: 'v4' }, sticky: false },
      ]
      const result = await invokeInterceptor()(makeOptimizationData(fresh))
      expect(
        result.selectedOptimizations.find((s) => s.experienceId === 'exp-1')?.variantIndex,
      ).toBe(5)
      expect(
        result.selectedOptimizations.find((s) => s.experienceId === 'exp-2')?.variantIndex,
      ).toBe(2)
      expect(
        result.selectedOptimizations.find((s) => s.experienceId === 'exp-4')?.variantIndex,
      ).toBe(0)
      expect(mgr.getBaselineSelectedOptimizations()).toEqual(fresh)
      mgr.resetAll()
      expect(selectedOptimizations.value).toEqual(fresh)
    })
  })

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('multiple audiences with overlapping experience IDs', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-A', ['exp-1', 'exp-2'])
      mgr.activateAudience('aud-B', ['exp-2', 'exp-3'])
      expect(mgr.getOverrides().selectedOptimizations['exp-2']?.variantIndex).toBe(1)
      mgr.resetAudienceOverride('aud-A')
      const overrides = mgr.getOverrides()
      expect(overrides.selectedOptimizations['exp-1']).toBeUndefined()
      expect(overrides.selectedOptimizations['exp-2']).toBeUndefined()
      expect(overrides.selectedOptimizations['exp-3']?.variantIndex).toBe(1)
      expect(overrides.audiences['aud-B']).toBeDefined()
    })

    it('re-activation after reset restores overrides', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-1', ['exp-99'])
      mgr.resetAudienceOverride('aud-1')
      mgr.activateAudience('aud-1', ['exp-99'])
      expect(sv().find((s) => s.experienceId === 'exp-99')).toEqual({
        experienceId: 'exp-99',
        variantIndex: 1,
        variants: {},
      })
      expect(mgr.getOverrides().audiences['aud-1'].isActive).toBe(true)
    })

    it('activate then deactivate same audience updates isActive and variant indices', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-1', ['exp-1'])
      expect(mgr.getOverrides().audiences['aud-1'].isActive).toBe(true)
      expect(mgr.getOverrides().selectedOptimizations['exp-1']?.variantIndex).toBe(1)
      mgr.deactivateAudience('aud-1', ['exp-1'])
      expect(mgr.getOverrides().audiences['aud-1'].isActive).toBe(false)
      expect(mgr.getOverrides().selectedOptimizations['exp-1']?.variantIndex).toBe(0)
    })

    it('undefined baseline -- syncOverridesToSignal uses empty array fallback', () => {
      const sig = signal<SelectedOptimizationArray | undefined>(undefined)
      const interceptors: StateInterceptorRegistry<OptimizationData> = {
        add: rs.fn(() => 99),
        remove: rs.fn(() => true),
      }
      const mgr = new PreviewOverrideManager({
        selectedOptimizations: sig,
        stateInterceptors: interceptors,
      })
      mgr.setVariantOverride('exp-1', 2)
      expect(sig.value).toEqual([{ experienceId: 'exp-1', variantIndex: 2, variants: {} }])
      mgr.destroy()
    })

    it('onOverridesChanged is optional -- no error when omitted', () => {
      const mgr = createManager()
      expect(() => {
        mgr.activateAudience('aud-1', ['exp-1'])
        mgr.deactivateAudience('aud-1', ['exp-1'])
        mgr.setVariantOverride('exp-1', 3)
        mgr.resetOptimizationOverride('exp-1')
        mgr.resetAll()
      }).not.toThrow()
    })
  })
})

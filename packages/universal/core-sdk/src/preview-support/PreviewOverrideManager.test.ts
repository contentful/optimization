import type {
  OptimizationData,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { signal } from '@preact/signals-core'
import { InterceptorManager } from '../lib/interceptor'
import { PreviewOverrideManager } from './PreviewOverrideManager'
import {
  BASELINE,
  makeOptimizationData,
  type InterceptorFn,
} from './PreviewOverrideManager.test-utils'

let selectedOptimizations: ReturnType<typeof signal<SelectedOptimizationArray | undefined>>
let stateInterceptors: InterceptorManager<OptimizationData>
let addSpy: ReturnType<typeof rs.spyOn>
let removeSpy: ReturnType<typeof rs.spyOn>
let onOverridesChanged: ReturnType<typeof rs.fn>
let capturedInterceptor: InterceptorFn | undefined
let manager: PreviewOverrideManager | undefined

const REGISTERED_ID = 42

function createManager(): PreviewOverrideManager {
  selectedOptimizations = signal<SelectedOptimizationArray | undefined>(BASELINE)
  stateInterceptors = new InterceptorManager<OptimizationData>()
  capturedInterceptor = undefined
  addSpy = rs.spyOn(stateInterceptors, 'add').mockImplementation((fn: InterceptorFn) => {
    capturedInterceptor = fn
    return REGISTERED_ID
  })
  removeSpy = rs.spyOn(stateInterceptors, 'remove').mockImplementation(() => true)
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
      const interceptors = new InterceptorManager<OptimizationData>()
      const mgr = new PreviewOverrideManager({
        selectedOptimizations: sig,
        stateInterceptors: interceptors,
        onOverridesChanged: rs.fn(),
      })
      expect(mgr.getBaselineSelectedOptimizations()).toBeNull()
      mgr.destroy()
    })

    it('registers a state interceptor and starts with empty overrides', () => {
      const mgr = createManager()
      expect(addSpy).toHaveBeenCalledTimes(1)
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
      const interceptors = new InterceptorManager<OptimizationData>()
      const mgr = new PreviewOverrideManager({
        selectedOptimizations: sig,
        stateInterceptors: interceptors,
        onOverridesChanged: rs.fn(),
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
      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith(REGISTERED_ID)
      expect(mgr.getOverrides()).toEqual({ audiences: {}, selectedOptimizations: {} })
      expect(mgr.getBaselineSelectedOptimizations()).toBeNull()
      expect(onOverridesChanged).not.toHaveBeenCalled()
    })

    it('calling destroy twice does not call remove twice', () => {
      const mgr = createManager()
      mgr.destroy()
      mgr.destroy()
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })
  })

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

    it('invokes onOverridesChanged after each API refresh', async () => {
      const mgr = createManager()
      onOverridesChanged.mockClear()

      // Refresh with no overrides present — callback should still fire so
      // consumers learn the underlying data changed.
      await invokeInterceptor()(makeOptimizationData(NEW_API))
      expect(onOverridesChanged).toHaveBeenCalledTimes(1)
      expect(onOverridesChanged).toHaveBeenLastCalledWith(mgr.getOverrides())

      // Apply an override, clear the mock, then run another refresh and
      // confirm the callback fires again with the current overrides snapshot.
      mgr.setVariantOverride('exp-1', 9)
      onOverridesChanged.mockClear()

      await invokeInterceptor()(makeOptimizationData(NEW_API))
      expect(onOverridesChanged).toHaveBeenCalledTimes(1)
      expect(onOverridesChanged).toHaveBeenLastCalledWith(mgr.getOverrides())
    })
  })
})

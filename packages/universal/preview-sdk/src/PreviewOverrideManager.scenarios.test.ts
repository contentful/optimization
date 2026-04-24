import type {
  OptimizationData,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { signal } from '@preact/signals-core'
import { PreviewOverrideManager, type StateInterceptorRegistry } from './PreviewOverrideManager'
import {
  BASELINE,
  makeOptimizationData,
  type InterceptorFn,
} from './PreviewOverrideManager.test-utils'

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

describe('PreviewOverrideManager — scenarios & edge cases', () => {
  afterEach(() => {
    manager?.destroy()
    manager = undefined
  })

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
      expect(mgr.getOverrides().audiences['aud-X']?.isActive).toBe(true)
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
      expect(mgr.getOverrides().audiences['aud-1']?.isActive).toBe(true)
    })

    it('activate then deactivate same audience updates isActive and variant indices', () => {
      const mgr = createManager()
      mgr.activateAudience('aud-1', ['exp-1'])
      expect(mgr.getOverrides().audiences['aud-1']?.isActive).toBe(true)
      expect(mgr.getOverrides().selectedOptimizations['exp-1']?.variantIndex).toBe(1)
      mgr.deactivateAudience('aud-1', ['exp-1'])
      expect(mgr.getOverrides().audiences['aud-1']?.isActive).toBe(false)
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
        onOverridesChanged: rs.fn(),
      })
      mgr.setVariantOverride('exp-1', 2)
      expect(sig.value).toEqual([{ experienceId: 'exp-1', variantIndex: 2, variants: {} }])
      mgr.destroy()
    })

    it('onOverridesChanged is invoked on every mutation', () => {
      const mgr = createManager()
      expect(() => {
        mgr.activateAudience('aud-1', ['exp-1'])
        mgr.deactivateAudience('aud-1', ['exp-1'])
        mgr.setVariantOverride('exp-1', 3)
        mgr.resetOptimizationOverride('exp-1')
        mgr.resetAll()
      }).not.toThrow()
      expect(onOverridesChanged).toHaveBeenCalled()
    })
  })
})

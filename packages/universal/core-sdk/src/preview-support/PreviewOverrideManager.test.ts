import type { SelectedOptimizationArray } from '@contentful/optimization-api-client/api-schemas'
import { signal } from '@preact/signals-core'
import type { OptimizationSelectionState } from '../handoff'
import { InterceptorManager } from '../lib/interceptor'
import { PreviewOverrideManager } from './PreviewOverrideManager'
import {
  BASELINE,
  makeOptimizationData,
  type InterceptorFn,
} from './PreviewOverrideManager.test-utils'

let selectedOptimizations: ReturnType<typeof signal<SelectedOptimizationArray | undefined>>
let stateInterceptors: InterceptorManager<OptimizationSelectionState>
let addSpy: ReturnType<typeof rs.spyOn>
let removeSpy: ReturnType<typeof rs.spyOn>
let onOverridesChanged: ReturnType<typeof rs.fn>
let capturedInterceptor: InterceptorFn | undefined
let manager: PreviewOverrideManager | undefined

const REGISTERED_ID = 42

function createManager(): PreviewOverrideManager {
  selectedOptimizations = signal<SelectedOptimizationArray | undefined>(BASELINE)
  stateInterceptors = new InterceptorManager<OptimizationSelectionState>()
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

function selectedFrom(state: OptimizationSelectionState): SelectedOptimizationArray {
  const { selectedOptimizations: value } = state
  if (value === undefined) throw new Error('Expected selected optimizations')
  return value
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
      const interceptors = new InterceptorManager<OptimizationSelectionState>()
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
      mgr.activateAudience('2WzXDaWtDmstHl9p8Wufpp', [
        '6IueRX1pS3iMJncbhUQTba',
        '5jT8mNPxQ2rVuY4wZaB6Cd',
      ])
      const overrides = mgr.getOverrides()
      expect(overrides.audiences['2WzXDaWtDmstHl9p8Wufpp']).toEqual({
        audienceId: '2WzXDaWtDmstHl9p8Wufpp',
        isActive: true,
        source: 'manual',
        experienceIds: ['6IueRX1pS3iMJncbhUQTba', '5jT8mNPxQ2rVuY4wZaB6Cd'],
      })
      expect(overrides.selectedOptimizations['6IueRX1pS3iMJncbhUQTba']).toEqual({
        experienceId: '6IueRX1pS3iMJncbhUQTba',
        variantIndex: 1,
      })
      expect(overrides.selectedOptimizations['5jT8mNPxQ2rVuY4wZaB6Cd']).toEqual({
        experienceId: '5jT8mNPxQ2rVuY4wZaB6Cd',
        variantIndex: 1,
      })
      expect(sv().find((s) => s.experienceId === '6IueRX1pS3iMJncbhUQTba')?.variantIndex).toBe(1)
      expect(sv().find((s) => s.experienceId === '5jT8mNPxQ2rVuY4wZaB6Cd')?.variantIndex).toBe(1)
    })

    it('appends entries for experiences NOT in the API baseline', () => {
      const mgr = createManager()
      mgr.activateAudience('7K9rQ3nU5wX7yZ9aB1cDeF', [
        '9AbC1DeF3GhI5JkL7MnOpQ',
        '1CdE3FgH5IjK7LmN9OpQrS',
      ])
      expect(sv()).toHaveLength(BASELINE.length + 2)
      expect(sv().find((s) => s.experienceId === '9AbC1DeF3GhI5JkL7MnOpQ')).toEqual({
        experienceId: '9AbC1DeF3GhI5JkL7MnOpQ',
        variantIndex: 1,
        variants: {},
      })
      expect(sv().find((s) => s.experienceId === '1CdE3FgH5IjK7LmN9OpQrS')).toEqual({
        experienceId: '1CdE3FgH5IjK7LmN9OpQrS',
        variantIndex: 1,
        variants: {},
      })
    })

    it('with empty experience list records audience but does not sync signal', () => {
      const mgr = createManager()
      const original = selectedOptimizations.value
      mgr.activateAudience('6J8qP2mT4vW6xY8zA0bCdE', [])
      expect(mgr.getOverrides().audiences['6J8qP2mT4vW6xY8zA0bCdE']).toEqual({
        audienceId: '6J8qP2mT4vW6xY8zA0bCdE',
        isActive: true,
        source: 'manual',
        experienceIds: [],
      })
      expect(selectedOptimizations.value).toBe(original)
      expect(onOverridesChanged).toHaveBeenCalledTimes(1)
    })

    it('invokes onOverridesChanged with updated state', () => {
      const mgr = createManager()
      mgr.activateAudience('2WzXDaWtDmstHl9p8Wufpp', ['6IueRX1pS3iMJncbhUQTba'])
      expect(onOverridesChanged).toHaveBeenCalledTimes(1)
      expect(onOverridesChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          audiences: expect.objectContaining({
            '2WzXDaWtDmstHl9p8Wufpp': expect.objectContaining({ isActive: true }),
          }),
        }),
      )
    })
  })

  describe('deactivateAudience', () => {
    it('sets variant index 0 (baseline) for all provided experience IDs', () => {
      const mgr = createManager()
      mgr.deactivateAudience('2WzXDaWtDmstHl9p8Wufpp', [
        '6IueRX1pS3iMJncbhUQTba',
        '5jT8mNPxQ2rVuY4wZaB6Cd',
      ])
      const overrides = mgr.getOverrides()
      expect(overrides.audiences['2WzXDaWtDmstHl9p8Wufpp']).toEqual({
        audienceId: '2WzXDaWtDmstHl9p8Wufpp',
        isActive: false,
        source: 'manual',
        experienceIds: ['6IueRX1pS3iMJncbhUQTba', '5jT8mNPxQ2rVuY4wZaB6Cd'],
      })
      expect(overrides.selectedOptimizations['6IueRX1pS3iMJncbhUQTba']?.variantIndex).toBe(0)
      expect(overrides.selectedOptimizations['5jT8mNPxQ2rVuY4wZaB6Cd']?.variantIndex).toBe(0)
      expect(sv().find((s) => s.experienceId === '6IueRX1pS3iMJncbhUQTba')?.variantIndex).toBe(0)
      expect(sv().find((s) => s.experienceId === '5jT8mNPxQ2rVuY4wZaB6Cd')?.variantIndex).toBe(0)
    })

    it('with empty experience list records audience as inactive without syncing signal', () => {
      const mgr = createManager()
      const original = selectedOptimizations.value
      mgr.deactivateAudience('6J8qP2mT4vW6xY8zA0bCdE', [])
      expect(mgr.getOverrides().audiences['6J8qP2mT4vW6xY8zA0bCdE']?.isActive).toBe(false)
      expect(selectedOptimizations.value).toBe(original)
      expect(onOverridesChanged).toHaveBeenCalledTimes(1)
    })
  })

  describe('setVariantOverride', () => {
    it('overrides an existing baseline experience variant', () => {
      const mgr = createManager()
      mgr.setVariantOverride('6IueRX1pS3iMJncbhUQTba', 3)
      expect(mgr.getOverrides().selectedOptimizations['6IueRX1pS3iMJncbhUQTba']).toEqual({
        experienceId: '6IueRX1pS3iMJncbhUQTba',
        variantIndex: 3,
      })
      expect(sv().find((s) => s.experienceId === '6IueRX1pS3iMJncbhUQTba')?.variantIndex).toBe(3)
      expect(sv().find((s) => s.experienceId === '5jT8mNPxQ2rVuY4wZaB6Cd')?.variantIndex).toBe(2)
      expect(sv().find((s) => s.experienceId === '7LcA9DeF2GhI4JkL6MnOpQ')?.variantIndex).toBe(0)
      expect(
        mgr
          .getBaselineSelectedOptimizations()
          ?.find((s) => s.experienceId === '6IueRX1pS3iMJncbhUQTba')?.variantIndex,
      ).toBe(1)
    })

    it('appends entry for experience not in baseline', () => {
      const mgr = createManager()
      mgr.setVariantOverride('3EfG5HiJ7KlM9NoP1QrStU', 2)
      expect(sv()).toHaveLength(BASELINE.length + 1)
      expect(sv().find((s) => s.experienceId === '3EfG5HiJ7KlM9NoP1QrStU')).toEqual({
        experienceId: '3EfG5HiJ7KlM9NoP1QrStU',
        variantIndex: 2,
        variants: {},
      })
    })

    it('multiple sequential overrides accumulate and can be overwritten', () => {
      const mgr = createManager()
      mgr.setVariantOverride('6IueRX1pS3iMJncbhUQTba', 3)
      mgr.setVariantOverride('5jT8mNPxQ2rVuY4wZaB6Cd', 5)
      expect(mgr.getOverrides().selectedOptimizations['6IueRX1pS3iMJncbhUQTba']?.variantIndex).toBe(
        3,
      )
      expect(mgr.getOverrides().selectedOptimizations['5jT8mNPxQ2rVuY4wZaB6Cd']?.variantIndex).toBe(
        5,
      )
      mgr.setVariantOverride('6IueRX1pS3iMJncbhUQTba', 7)
      expect(mgr.getOverrides().selectedOptimizations['6IueRX1pS3iMJncbhUQTba']?.variantIndex).toBe(
        7,
      )
      expect(sv().find((s) => s.experienceId === '6IueRX1pS3iMJncbhUQTba')?.variantIndex).toBe(7)
      expect(onOverridesChanged).toHaveBeenCalledTimes(3)
    })

    it('derives signal from baseline, not from stale signal value', () => {
      const mgr = createManager()
      mgr.setVariantOverride('6IueRX1pS3iMJncbhUQTba', 3)
      selectedOptimizations.value = []
      mgr.setVariantOverride('5jT8mNPxQ2rVuY4wZaB6Cd', 5)
      expect(sv().length).toBeGreaterThanOrEqual(BASELINE.length)
      expect(sv().find((s) => s.experienceId === '6IueRX1pS3iMJncbhUQTba')?.variantIndex).toBe(3)
      expect(sv().find((s) => s.experienceId === '5jT8mNPxQ2rVuY4wZaB6Cd')?.variantIndex).toBe(5)
      expect(sv().find((s) => s.experienceId === '7LcA9DeF2GhI4JkL6MnOpQ')?.variantIndex).toBe(0)
    })
  })

  describe('resetOptimizationOverride', () => {
    it('removes a single experience override and recomputes signal from baseline', () => {
      const mgr = createManager()
      mgr.setVariantOverride('6IueRX1pS3iMJncbhUQTba', 3)
      mgr.setVariantOverride('5jT8mNPxQ2rVuY4wZaB6Cd', 5)
      mgr.resetOptimizationOverride('6IueRX1pS3iMJncbhUQTba')
      expect(mgr.getOverrides().selectedOptimizations['6IueRX1pS3iMJncbhUQTba']).toBeUndefined()
      expect(mgr.getOverrides().selectedOptimizations['5jT8mNPxQ2rVuY4wZaB6Cd']?.variantIndex).toBe(
        5,
      )
      expect(sv().find((s) => s.experienceId === '6IueRX1pS3iMJncbhUQTba')?.variantIndex).toBe(1)
      expect(sv().find((s) => s.experienceId === '5jT8mNPxQ2rVuY4wZaB6Cd')?.variantIndex).toBe(5)
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
      mgr.activateAudience('2WzXDaWtDmstHl9p8Wufpp', [
        '6IueRX1pS3iMJncbhUQTba',
        '5jT8mNPxQ2rVuY4wZaB6Cd',
      ])
      mgr.resetAudienceOverride('2WzXDaWtDmstHl9p8Wufpp')
      expect(mgr.getOverrides()).toEqual({ audiences: {}, selectedOptimizations: {} })
      expect(sv().find((s) => s.experienceId === '6IueRX1pS3iMJncbhUQTba')?.variantIndex).toBe(1)
      expect(sv().find((s) => s.experienceId === '5jT8mNPxQ2rVuY4wZaB6Cd')?.variantIndex).toBe(2)
    })

    it('only removes experiences belonging to the reset audience, preserves others', () => {
      const mgr = createManager()
      mgr.activateAudience('2WzXDaWtDmstHl9p8Wufpp', ['6IueRX1pS3iMJncbhUQTba'])
      mgr.setVariantOverride('5jT8mNPxQ2rVuY4wZaB6Cd', 5)
      mgr.resetAudienceOverride('2WzXDaWtDmstHl9p8Wufpp')
      expect(mgr.getOverrides().selectedOptimizations['6IueRX1pS3iMJncbhUQTba']).toBeUndefined()
      expect(mgr.getOverrides().selectedOptimizations['5jT8mNPxQ2rVuY4wZaB6Cd']?.variantIndex).toBe(
        5,
      )
      expect(mgr.getOverrides().audiences['2WzXDaWtDmstHl9p8Wufpp']).toBeUndefined()
    })

    it('resetting audience with no stored experience IDs still notifies', () => {
      const mgr = createManager()
      mgr.activateAudience('6J8qP2mT4vW6xY8zA0bCdE', [])
      onOverridesChanged.mockClear()
      mgr.resetAudienceOverride('6J8qP2mT4vW6xY8zA0bCdE')
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
      mgr.activateAudience('2WzXDaWtDmstHl9p8Wufpp', ['6IueRX1pS3iMJncbhUQTba'])
      mgr.setVariantOverride('5jT8mNPxQ2rVuY4wZaB6Cd', 5)
      mgr.resetAll()
      expect(mgr.getOverrides()).toEqual({ audiences: {}, selectedOptimizations: {} })
      expect(selectedOptimizations.value).toEqual(BASELINE)
    })

    it('handles resetAll when baseline is null (signal initially undefined)', () => {
      const sig = signal<SelectedOptimizationArray | undefined>(undefined)
      const interceptors = new InterceptorManager<OptimizationSelectionState>()
      const mgr = new PreviewOverrideManager({
        selectedOptimizations: sig,
        stateInterceptors: interceptors,
        onOverridesChanged: rs.fn(),
      })
      mgr.setVariantOverride('6IueRX1pS3iMJncbhUQTba', 1)
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
      mgr.activateAudience('2WzXDaWtDmstHl9p8Wufpp', ['6IueRX1pS3iMJncbhUQTba'])
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
      {
        experienceId: '6IueRX1pS3iMJncbhUQTba',
        variantIndex: 1,
        variants: { '4ib0hsHWoSOnCVdDkizE8d': '4k6ZyFQnR2POY5IJLLlJRb' },
        sticky: false,
      },
      {
        experienceId: '5jT8mNPxQ2rVuY4wZaB6Cd',
        variantIndex: 2,
        variants: { '4k6ZyFQnR2POY5IJLLlJRb': '2qVK4T5lnScbswoyBuGipd' },
        sticky: false,
      },
      {
        experienceId: '8RsT1UvW3XyZ5AbC7DeFgH',
        variantIndex: 0,
        variants: { '3Z2hP4vR8sT1nY6mK9qL0a': '5mN8rY2pL6qT9vW3xA4bCd' },
        sticky: false,
      },
    ]

    it('caches incoming API data as new baseline', () => {
      const mgr = createManager()
      invokeInterceptor()(makeOptimizationData(NEW_API))
      expect(mgr.getBaselineSelectedOptimizations()).toEqual(NEW_API)
    })

    it('leaves selected baseline unchanged when refresh omits selectedOptimizations', async () => {
      const mgr = createManager()

      await invokeInterceptor()({ profile: makeOptimizationData(NEW_API).profile })

      expect(mgr.getBaselineSelectedOptimizations()).toEqual(BASELINE)
    })

    it('captures present undefined selected baseline for resetAll', async () => {
      const mgr = createManager()
      mgr.setVariantOverride('6IueRX1pS3iMJncbhUQTba', 7)

      await invokeInterceptor()({ selectedOptimizations: undefined })
      mgr.resetAll()

      expect(selectedOptimizations.value).toBeUndefined()
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
      mgr.setVariantOverride('6IueRX1pS3iMJncbhUQTba', 7)
      const result = await invokeInterceptor()(makeOptimizationData(NEW_API))
      const resultSelectedOptimizations = selectedFrom(result)
      expect(
        resultSelectedOptimizations.find((s) => s.experienceId === '6IueRX1pS3iMJncbhUQTba')
          ?.variantIndex,
      ).toBe(7)
      expect(
        resultSelectedOptimizations.find((s) => s.experienceId === '5jT8mNPxQ2rVuY4wZaB6Cd')
          ?.variantIndex,
      ).toBe(2)
    })

    it('appends overridden experiences not in API data', async () => {
      const mgr = createManager()
      mgr.setVariantOverride('3EfG5HiJ7KlM9NoP1QrStU', 3)
      const result = await invokeInterceptor()(makeOptimizationData(NEW_API))
      const resultSelectedOptimizations = selectedFrom(result)
      expect(resultSelectedOptimizations).toHaveLength(NEW_API.length + 1)
      expect(
        resultSelectedOptimizations.find((s) => s.experienceId === '3EfG5HiJ7KlM9NoP1QrStU'),
      ).toEqual({
        experienceId: '3EfG5HiJ7KlM9NoP1QrStU',
        variantIndex: 3,
        variants: {},
      })
    })

    it('updates baseline so future resets use fresh API data', () => {
      const mgr = createManager()
      mgr.setVariantOverride('6IueRX1pS3iMJncbhUQTba', 7)
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
      mgr.setVariantOverride('6IueRX1pS3iMJncbhUQTba', 9)
      onOverridesChanged.mockClear()

      await invokeInterceptor()(makeOptimizationData(NEW_API))
      expect(onOverridesChanged).toHaveBeenCalledTimes(1)
      expect(onOverridesChanged).toHaveBeenLastCalledWith(mgr.getOverrides())
    })
  })
})

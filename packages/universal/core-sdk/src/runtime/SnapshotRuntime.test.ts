import type { OptimizationData } from '@contentful/optimization-api-client/api-schemas'
import { describe, expect, it } from '@rstest/core'
import { mergeTagEntry } from '../test/fixtures/mergeTagEntry'
import { optimizedEntry } from '../test/fixtures/optimizedEntry'
import { profile } from '../test/fixtures/profile'
import { selectedOptimizations } from '../test/fixtures/selectedOptimizations'
import { createSnapshotRuntime } from './SnapshotRuntime'

const snapshotData: OptimizationData = {
  profile,
  selectedOptimizations,
  changes: [
    {
      type: 'Variable',
      key: 'theme',
      value: 'dark',
      meta: { experienceId: 'exp-theme', variantIndex: 1 },
    },
  ],
}

describe('SnapshotRuntime', () => {
  describe('resolve surface', () => {
    it('resolves the optimized variant using the snapshot selectedOptimizations', () => {
      const runtime = createSnapshotRuntime({ data: snapshotData })

      const fromSnapshot = runtime.resolveOptimizedEntry(optimizedEntry)
      const fromExplicit = runtime.resolveOptimizedEntry(optimizedEntry, selectedOptimizations)

      expect(fromSnapshot.selectedOptimization).toBeDefined()
      expect(fromSnapshot.entry.sys.id).toBe(fromExplicit.entry.sys.id)
      expect(fromSnapshot.selectedOptimization).toEqual(fromExplicit.selectedOptimization)
    })

    it('returns the baseline entry when the snapshot has no optimizations', () => {
      const runtime = createSnapshotRuntime()

      const result = runtime.resolveOptimizedEntry(optimizedEntry)

      expect(result.entry).toBe(optimizedEntry)
      expect(result.selectedOptimization).toBeUndefined()
    })

    it('resolves merge tags against the snapshot profile', () => {
      const runtime = createSnapshotRuntime({ data: snapshotData })

      expect(runtime.getMergeTagValue(mergeTagEntry)).toBe('EU')
    })

    it('falls back to the merge-tag fallback without a profile', () => {
      const runtime = createSnapshotRuntime()

      expect(runtime.getMergeTagValue(mergeTagEntry)).toBe('Nowhere')
    })

    it('resolves flags from the snapshot changes', () => {
      const runtime = createSnapshotRuntime({ data: snapshotData })

      expect(runtime.getFlag('theme')).toBe('dark')
      expect(runtime.getFlag('missing')).toBeUndefined()
    })
  })

  describe('read surface', () => {
    it('exposes static observables seeded from the snapshot', () => {
      const runtime = createSnapshotRuntime({
        data: snapshotData,
        consent: true,
        locale: 'de-DE',
      })

      expect(runtime.states.consent.current).toBe(true)
      expect(runtime.states.locale.current).toBe('de-DE')
      expect(runtime.states.profile.current).toEqual(profile)
      expect(runtime.states.selectedOptimizations.current).toEqual(selectedOptimizations)
      expect(runtime.states.canOptimize.current).toBe(true)
      expect(runtime.states.experienceRequestState.current).toEqual({ status: 'success' })
      expect(runtime.locale).toBe('de-DE')
      expect(runtime.hasConsent('track')).toBe(true)
    })

    it('reports canOptimize false and a settled request state without server data', () => {
      const runtime = createSnapshotRuntime()

      expect(runtime.states.canOptimize.current).toBe(false)
      // A snapshot is always settled — no experience request is in flight for the
      // render it backs — so consumers present content instead of a loading state.
      expect(runtime.states.experienceRequestState.current).toEqual({ status: 'success' })
      expect(runtime.states.profile.current).toBeUndefined()
      expect(runtime.hasConsent('track')).toBe(false)
    })

    it('reports optimizationPossible false when consent is absent and nothing is allow-listed', () => {
      const runtime = createSnapshotRuntime({ consent: false, allowedEventTypes: [] })

      expect(runtime.states.optimizationPossible.current).toBe(false)
    })

    it('reports optimizationPossible true when an unlocking event type is allow-listed pre-consent', () => {
      const runtime = createSnapshotRuntime({ consent: false, allowedEventTypes: ['page'] })

      expect(runtime.states.optimizationPossible.current).toBe(true)
    })

    it('resolves hasConsent through the allow-list when consent is not granted', () => {
      const runtime = createSnapshotRuntime({
        consent: false,
        allowedEventTypes: ['page', 'component'],
      })

      // `page` is allow-listed directly; `trackView` maps to the `component`
      // selector, which is allow-listed; `trackClick` maps to `component_click`,
      // which is not.
      expect(runtime.hasConsent('page')).toBe(true)
      expect(runtime.hasConsent('trackView')).toBe(true)
      expect(runtime.hasConsent('trackClick')).toBe(false)
    })

    it('grants every hasConsent check when consent is true regardless of allow-list', () => {
      const runtime = createSnapshotRuntime({ consent: true, allowedEventTypes: [] })

      expect(runtime.hasConsent('trackClick')).toBe(true)
      expect(runtime.states.optimizationPossible.current).toBe(true)
    })

    it('emits each state value once on subscribe', () => {
      const runtime = createSnapshotRuntime({ data: snapshotData, consent: true })
      const received: Array<boolean | undefined> = []

      const subscription = runtime.states.consent.subscribe((value) => {
        received.push(value)
      })

      expect(received).toEqual([true])
      subscription.unsubscribe()
    })

    it('defaults preview panel state to closed', () => {
      const runtime = createSnapshotRuntime({ data: snapshotData })

      expect(runtime.states.previewPanelAttached.current).toBe(false)
      expect(runtime.states.previewPanelOpen.current).toBe(false)
    })
  })

  describe('inert actions', () => {
    it('treats event actions as accepted:false no-ops', async () => {
      const runtime = createSnapshotRuntime({ data: snapshotData })

      await expect(runtime.identify({ userId: 'user-1' })).resolves.toEqual({ accepted: false })
      await expect(runtime.page()).resolves.toEqual({ accepted: false })
      await expect(runtime.track({ event: 'purchase' })).resolves.toEqual({ accepted: false })
      await expect(
        runtime.trackView({ componentId: 'component-1', viewId: 'view-1', viewDurationMs: 100 }),
      ).resolves.toEqual({ accepted: false })
    })

    it('treats state and lifecycle actions as no-ops that do not throw', async () => {
      const runtime = createSnapshotRuntime({ data: snapshotData })

      expect(() => {
        runtime.consent(true)
      }).not.toThrow()
      expect(() => {
        runtime.reset()
      }).not.toThrow()
      expect(() => {
        runtime.destroy()
      }).not.toThrow()
      expect(runtime.setLocale('en-US')).toBeUndefined()
      await expect(runtime.flush()).resolves.toBeUndefined()
    })
  })
})

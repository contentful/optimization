import type { OptimizationData } from '@contentful/optimization-api-client/api-schemas'
import { describe, expect, it } from '@rstest/core'
import type { OptimizationSelectionState } from '../handoff'
import { mergeTagEntry } from '../test/fixtures/mergeTagEntry'
import { optimizedEntry } from '../test/fixtures/optimizedEntry'
import { profile } from '../test/fixtures/profile'
import { selectedOptimizations } from '../test/fixtures/selectedOptimizations'
import { createSnapshotRuntime } from './SnapshotRuntime'

const snapshotData: OptimizationData = {
  changes: [
    {
      key: 'theme',
      meta: { experienceId: 'exp-theme', variantIndex: 1 },
      type: 'Variable',
      value: 'dark',
    },
  ],
  profile,
  selectedOptimizations,
}

describe('SnapshotRuntime', () => {
  it('resolves entries, merge tags, and flags from snapshot data', () => {
    const runtime = createSnapshotRuntime({ data: snapshotData })
    const resolved = runtime.resolveOptimizedEntry(optimizedEntry)
    const explicit = runtime.resolveOptimizedEntry(optimizedEntry, selectedOptimizations)

    expect(resolved.entry.sys.id).toBe(explicit.entry.sys.id)
    expect(resolved.selectedOptimization).toEqual(explicit.selectedOptimization)
    expect(runtime.getMergeTagValue(mergeTagEntry)).toBe('EU')
    expect(runtime.getFlag('theme')).toBe('dark')
  })

  it('exposes settled static state for SSR and first client render', () => {
    const runtime = createSnapshotRuntime({
      allowedEventTypes: ['page'],
      consent: false,
      data: snapshotData,
      locale: 'en-US',
      persistenceConsent: false,
    })
    const observedConsent: Array<boolean | undefined> = []

    const subscription = runtime.states.consent.subscribe((value) => {
      observedConsent.push(value)
    })

    expect(runtime.locale).toBe('en-US')
    expect(runtime.states.profile.current).toEqual(profile)
    expect(runtime.states.selectedOptimizations.current).toEqual(selectedOptimizations)
    expect(runtime.states.canOptimize.current).toBe(true)
    expect(runtime.states.experienceRequestState.current).toEqual({ status: 'success' })
    expect(runtime.states.optimizationPossible.current).toBe(true)
    expect(runtime.hasConsent('page')).toBe(true)
    expect(runtime.hasConsent('track')).toBe(false)
    expect(observedConsent).toEqual([false])
    subscription.unsubscribe()
  })

  it('falls back to baseline state without optimization data', () => {
    const runtime = createSnapshotRuntime({ allowedEventTypes: [], consent: false })
    const resolved = runtime.resolveOptimizedEntry(optimizedEntry)

    expect(resolved.entry).toBe(optimizedEntry)
    expect(resolved.selectedOptimization).toBeUndefined()
    expect(runtime.states.profile.current).toBeUndefined()
    expect(runtime.states.selectedOptimizations.current).toBeUndefined()
    expect(runtime.states.canOptimize.current).toBe(false)
    expect(runtime.states.optimizationPossible.current).toBe(false)
    expect(runtime.getMergeTagValue(mergeTagEntry)).toBe('Nowhere')
  })

  it('accepts profile-optional selection state', () => {
    const selectionState: OptimizationSelectionState = { selectedOptimizations }
    const runtime = createSnapshotRuntime({ data: selectionState })
    const resolved = runtime.resolveOptimizedEntry(optimizedEntry)

    expect(resolved.entry.sys.id).toBe('4k6ZyFQnR2POY5IJLLlJRb')
    expect(runtime.states.profile.current).toBeUndefined()
    expect(runtime.states.selectedOptimizations.current).toBe(selectedOptimizations)
    expect(runtime.states.canOptimize.current).toBe(true)
  })

  it('treats server-side actions as inert no-ops', async () => {
    const runtime = createSnapshotRuntime({ data: snapshotData })

    await expect(runtime.identify({ userId: 'user-1' })).resolves.toEqual({ accepted: false })
    await expect(runtime.page()).resolves.toEqual({ accepted: false })
    await expect(runtime.track({ event: 'purchase' })).resolves.toEqual({ accepted: false })
    await expect(runtime.flush()).resolves.toBeUndefined()
    expect(runtime.setLocale('de-DE')).toBeUndefined()
    expect(() => {
      runtime.consent(true)
      runtime.reset()
      runtime.destroy()
    }).not.toThrow()
  })
})

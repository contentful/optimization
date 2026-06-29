import type { ResolvedData } from '@contentful/optimization-core'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import type { Entry, EntrySkeletonType } from 'contentful'
import React, { act } from 'react'
import { loadTestRenderer } from '../test/testRenderer'
import { isRecord } from '../test/typeGuards'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const TEST_DWELL_TIME_MS = 1234
const TEST_MIN_VISIBLE_RATIO = 0.4

const selectedOptimizations = {
  current: undefined,
  subscribe: rs.fn(() => ({ unsubscribe: rs.fn() })),
}
const resolveOptimizedEntry = rs.fn((entry: Entry): ResolvedData<EntrySkeletonType> => ({ entry }))
const useViewportTracking = rs.fn((_options: Record<string, unknown>) => ({
  isVisible: false,
  onLayout: rs.fn(),
}))
const useTapTracking = rs.fn((_options: Record<string, unknown>) => ({
  onTouchEnd: undefined,
  onTouchStart: undefined,
}))

rs.mock('react-native', () => ({
  View: 'View',
}))

rs.mock('../context/OptimizationContext', () => ({
  useOptimization: () => ({
    resolveOptimizedEntry,
    states: {
      selectedOptimizations,
    },
  }),
}))

rs.mock('../hooks/useViewportTracking', () => ({
  useViewportTracking,
}))

rs.mock('../hooks/useTapTracking', () => ({
  useTapTracking,
}))

interface TestRenderer {
  unmount: () => void
}

function createEntry(id: string): Entry {
  return {
    sys: {
      id,
      type: 'Entry',
      contentType: { sys: { id: 'testType', type: 'Link', linkType: 'ContentType' } },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      environment: { sys: { id: 'master', type: 'Link', linkType: 'Environment' } },
      publishedVersion: 1,
      space: { sys: { id: 'space1', type: 'Link', linkType: 'Space' } },
      revision: 1,
      locale: 'en-US',
    },
    fields: { title: id },
    metadata: { concepts: [], tags: [] },
  }
}

function getCallOptions(
  mock: typeof useViewportTracking | typeof useTapTracking,
): Record<string, unknown> {
  const {
    mock: {
      calls: [call],
    },
  } = mock

  if (call === undefined) {
    throw new Error('Expected hook to be called')
  }

  const [firstArg] = call
  const options: unknown = firstArg

  if (!isRecord(options)) {
    throw new Error('Expected hook options to be captured')
  }

  return options
}

describe('OptimizedEntry', () => {
  let renderer: TestRenderer | undefined = undefined

  void beforeEach(() => {
    rs.clearAllMocks()
    selectedOptimizations.current = undefined
  })

  void afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount()
      })
      renderer = undefined
    }
  })

  it('passes baselineEntry and renamed view timing props to viewport tracking', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const baselineEntry = createEntry('baseline-entry')
    baselineEntry.fields = { ...baselineEntry.fields, nt_experiences: [] }

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry
          baselineEntry={baselineEntry}
          dwellTimeMs={TEST_DWELL_TIME_MS}
          minVisibleRatio={TEST_MIN_VISIBLE_RATIO}
        >
          content
        </OptimizedEntry>,
      )
    })

    const viewportOptions = getCallOptions(useViewportTracking)
    expect(viewportOptions.entry).toBe(baselineEntry)
    expect(viewportOptions.dwellTimeMs).toBe(TEST_DWELL_TIME_MS)
    expect(viewportOptions.minVisibleRatio).toBe(TEST_MIN_VISIBLE_RATIO)
    expect(viewportOptions).not.toHaveProperty('viewTimeMs')
    expect(viewportOptions).not.toHaveProperty('threshold')
  })

  it('uses React Native interaction tracking defaults', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const baselineEntry = createEntry('baseline-entry')
    baselineEntry.fields = { ...baselineEntry.fields, nt_experiences: [] }

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry}>content</OptimizedEntry>,
      )
    })

    expect(getCallOptions(useViewportTracking).enabled).toBe(true)
    expect(getCallOptions(useTapTracking).enabled).toBe(true)
  })

  it('applies per-entry view and tap tracking overrides', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const baselineEntry = createEntry('baseline-entry')

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry} trackTaps trackViews={false}>
          content
        </OptimizedEntry>,
      )
    })

    expect(getCallOptions(useViewportTracking).enabled).toBe(false)
    expect(getCallOptions(useTapTracking).enabled).toBe(true)
  })

  it('allows per-entry tap tracking opt out', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const baselineEntry = createEntry('baseline-entry')

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry} trackTaps={false}>
          content
        </OptimizedEntry>,
      )
    })

    expect(getCallOptions(useViewportTracking).enabled).toBe(true)
    expect(getCallOptions(useTapTracking).enabled).toBe(false)
  })

  it('passes optimizationContextId to viewport and tap tracking', async () => {
    resolveOptimizedEntry.mockReturnValueOnce({
      entry: createEntry('resolved-entry'),
      optimizationContextId: 'ctx-1',
      selectedOptimization: {
        experienceId: 'exp-1',
        sticky: false,
        variantIndex: 1,
        variants: {},
      },
    })
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer<TestRenderer>()
    const baselineEntry = createEntry('baseline-entry')
    baselineEntry.fields = { ...baselineEntry.fields, nt_experiences: [] }

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry} trackTaps>
          content
        </OptimizedEntry>,
      )
    })

    expect(getCallOptions(useViewportTracking).optimizationContextId).toBe('ctx-1')
    expect(getCallOptions(useTapTracking).optimizationContextId).toBe('ctx-1')
  })
})

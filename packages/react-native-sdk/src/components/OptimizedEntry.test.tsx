import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import type { Entry } from 'contentful'
import React, { act, type ReactElement } from 'react'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const selectedOptimizations = {
  current: undefined,
  subscribe: rs.fn(() => ({ unsubscribe: rs.fn() })),
}
const resolveOptimizedEntry = rs.fn((entry: Entry) => ({ entry }))
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

interface TestRendererModule {
  create: (element: ReactElement) => TestRenderer
}

function isTestRendererModule(value: unknown): value is TestRendererModule {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return typeof Reflect.get(value, 'create') === 'function'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function loadTestRenderer(): Promise<TestRendererModule> {
  const moduleName = 'react-test-renderer'
  const testRendererModule: unknown = await import(moduleName)

  if (!isTestRendererModule(testRendererModule)) {
    throw new Error('Expected react-test-renderer to expose create().')
  }

  return testRendererModule
}

function createEntry(id: string): Entry {
  return {
    // @ts-expect-error -- partial mock for focused component tests
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
    fields: { title: id },
    metadata: { tags: [] },
  }
}

function getCallOptions(
  mock: typeof useViewportTracking | typeof useTapTracking,
): Record<string, unknown> {
  const call = mock.mock.calls[0]

  if (call === undefined) {
    throw new Error('Expected hook to be called')
  }

  const options: unknown = call[0]

  if (!isRecord(options)) {
    throw new Error('Expected hook options to be captured')
  }

  return options
}

describe('OptimizedEntry', () => {
  let renderer: TestRenderer | undefined

  beforeEach(() => {
    rs.clearAllMocks()
    selectedOptimizations.current = undefined
  })

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount()
      })
      renderer = undefined
    }
  })

  it('passes baselineEntry and renamed view timing props to viewport tracking', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer()
    const baselineEntry = createEntry('baseline-entry')

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry} dwellTimeMs={1234} minVisibleRatio={0.4}>
          content
        </OptimizedEntry>,
      )
    })

    const viewportOptions = getCallOptions(useViewportTracking)
    expect(viewportOptions.entry).toBe(baselineEntry)
    expect(viewportOptions.dwellTimeMs).toBe(1234)
    expect(viewportOptions.minVisibleRatio).toBe(0.4)
    expect(viewportOptions).not.toHaveProperty('viewTimeMs')
    expect(viewportOptions).not.toHaveProperty('threshold')
  })

  it('uses React Native interaction tracking defaults', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer()
    const baselineEntry = createEntry('baseline-entry')

    act(() => {
      renderer = testRenderer.create(
        <OptimizedEntry baselineEntry={baselineEntry}>content</OptimizedEntry>,
      )
    })

    expect(getCallOptions(useViewportTracking).enabled).toBe(true)
    expect(getCallOptions(useTapTracking).enabled).toBe(false)
  })

  it('applies per-entry view and tap tracking overrides', async () => {
    const { OptimizedEntry } = await import('./OptimizedEntry')
    const testRenderer = await loadTestRenderer()
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
})

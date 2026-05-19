import type { SelectedOptimizationArray } from '@contentful/optimization-core/api-schemas'
import { beforeEach, describe, expect, it, rs } from '@rstest/core'
import type { Entry } from 'contentful'

const selectedOptimizations: { current: SelectedOptimizationArray | undefined } = {
  current: undefined,
}
const resolveOptimizedEntry = rs.fn((entry: Entry) => ({ entry }))

rs.mock('../context/OptimizationContext', () => ({
  useOptimization: () => ({
    resolveOptimizedEntry,
    states: {
      selectedOptimizations,
    },
  }),
}))

rs.mock('react', () => ({
  useMemo: (factory: () => unknown) => factory(),
}))

function createEntry(id: string): Entry {
  return {
    // @ts-expect-error -- partial mock for focused resolver tests
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

describe('useEntryResolver', () => {
  beforeEach(() => {
    rs.clearAllMocks()
    selectedOptimizations.current = [
      {
        experienceId: 'exp-current',
        variantIndex: 1,
        variants: { baseline: 'variant-current' },
      },
    ]
    resolveOptimizedEntry.mockImplementation((entry: Entry) => ({
      entry: {
        ...entry,
        sys: {
          ...entry.sys,
          id: 'variant-entry',
        },
      },
      selectedOptimization: undefined,
    }))
  })

  it('resolves entries with the current selected optimizations by default', async () => {
    const { useEntryResolver } = await import('./useEntryResolver')
    const baselineEntry = createEntry('baseline-entry')

    const resolver = useEntryResolver()

    expect(resolver.resolveEntry(baselineEntry).sys.id).toBe('variant-entry')
    expect(resolveOptimizedEntry).toHaveBeenCalledWith(baselineEntry, selectedOptimizations.current)
  })

  it('accepts explicit selected optimizations for all resolver helpers', async () => {
    const { useEntryResolver } = await import('./useEntryResolver')
    const baselineEntry = createEntry('baseline-entry')
    const explicitSelections: SelectedOptimizationArray = [
      {
        experienceId: 'exp-explicit',
        variantIndex: 2,
        variants: { baseline: 'variant-explicit' },
      },
    ]

    const resolver = useEntryResolver()

    expect(resolver.resolveOptimizedEntry(baselineEntry, explicitSelections).entry.sys.id).toBe(
      'variant-entry',
    )
    expect(resolver.resolveEntryData(baselineEntry, explicitSelections).entry.sys.id).toBe(
      'variant-entry',
    )
    expect(resolveOptimizedEntry).toHaveBeenLastCalledWith(baselineEntry, explicitSelections)
  })
})

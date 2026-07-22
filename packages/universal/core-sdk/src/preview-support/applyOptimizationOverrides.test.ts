import {
  isResolvedOptimizationEntry,
  type OptimizationEntry,
  type SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { applyOptimizationOverrides } from './applyOptimizationOverrides'
import type { OptimizationOverride } from './types'

function buildEntry(experienceId: string, components: unknown[]): OptimizationEntry {
  const entry: unknown = {
    metadata: { tags: [], concepts: [] },
    sys: {
      space: { sys: { type: 'Link', linkType: 'Space', id: 's' } },
      id: `entry-${experienceId}`,
      type: 'Entry',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      environment: { sys: { id: 'master', type: 'Link', linkType: 'Environment' } },
      publishedVersion: 1,
      revision: 1,
      contentType: { sys: { type: 'Link', linkType: 'ContentType', id: 'nt_experience' } },
      locale: 'en-US',
    },
    fields: {
      nt_name: `Experience ${experienceId}`,
      nt_type: 'nt_personalization',
      nt_experience_id: experienceId,
      nt_config: { components, distribution: [0, 1] },
    },
  }

  if (!isResolvedOptimizationEntry(entry)) {
    throw new Error(`Expected ${experienceId} fixture to be a resolved optimization entry`)
  }
  return entry
}

const OVERRIDE = (experienceId: string, variantIndex: number): OptimizationOverride => ({
  experienceId,
  variantIndex,
})

describe('applyOptimizationOverrides', () => {
  it('returns the input array unchanged when no overrides are provided', () => {
    const baseline: SelectedOptimizationArray = [
      { experienceId: 'exp-1', variantIndex: 0, variants: {} },
    ]
    expect(applyOptimizationOverrides(baseline, {})).toBe(baseline)
  })

  it('updates variantIndex on existing entries and leaves variants untouched when no entries are supplied', () => {
    const baseline: SelectedOptimizationArray = [
      { experienceId: 'exp-1', variantIndex: 0, variants: { 'baseline-a': '' } },
    ]
    const result = applyOptimizationOverrides(baseline, { 'exp-1': OVERRIDE('exp-1', 1) })
    expect(result).toEqual([
      { experienceId: 'exp-1', variantIndex: 1, variants: { 'baseline-a': '' } },
    ])
  })

  it('synthesises variants map from nt_config components for a forced variant', () => {
    const entry = buildEntry('exp-1', [
      {
        type: 'EntryReplacement',
        baseline: { id: 'baseline-a' },
        variants: [{ id: 'variant-a-1' }, { id: 'variant-a-2' }],
      },
      {
        type: 'EntryReplacement',
        baseline: { id: 'baseline-b' },
        variants: [{ id: 'variant-b-1' }],
      },
    ])
    const baseline: SelectedOptimizationArray = [
      { experienceId: 'exp-1', variantIndex: 0, variants: {} },
    ]
    const result = applyOptimizationOverrides(baseline, { 'exp-1': OVERRIDE('exp-1', 1) }, [entry])
    expect(result[0]?.variants).toEqual({
      'baseline-a': 'variant-a-1',
      'baseline-b': 'variant-b-1',
    })
  })

  it('emits empty strings for every baseline when the override picks index 0', () => {
    const entry = buildEntry('exp-1', [
      {
        type: 'EntryReplacement',
        baseline: { id: 'baseline-a' },
        variants: [{ id: 'variant-a-1' }],
      },
    ])
    const baseline: SelectedOptimizationArray = [
      { experienceId: 'exp-1', variantIndex: 1, variants: { 'baseline-a': 'variant-a-1' } },
    ]
    const result = applyOptimizationOverrides(baseline, { 'exp-1': OVERRIDE('exp-1', 0) }, [entry])
    expect(result[0]?.variants).toEqual({ 'baseline-a': '' })
  })

  it('emits an empty string when the picked variant is out of range', () => {
    const entry = buildEntry('exp-1', [
      {
        type: 'EntryReplacement',
        baseline: { id: 'baseline-a' },
        variants: [{ id: 'variant-a-1' }],
      },
    ])
    const result = applyOptimizationOverrides(
      [{ experienceId: 'exp-1', variantIndex: 0, variants: {} }],
      { 'exp-1': OVERRIDE('exp-1', 99) },
      [entry],
    )
    expect(result[0]?.variants).toEqual({ 'baseline-a': '' })
  })

  it('emits an empty string when the picked variant is hidden', () => {
    const entry = buildEntry('exp-1', [
      {
        type: 'EntryReplacement',
        baseline: { id: 'baseline-a' },
        variants: [{ id: 'variant-a-1', hidden: true }],
      },
    ])
    const result = applyOptimizationOverrides(
      [{ experienceId: 'exp-1', variantIndex: 0, variants: {} }],
      { 'exp-1': OVERRIDE('exp-1', 1) },
      [entry],
    )
    expect(result[0]?.variants).toEqual({ 'baseline-a': '' })
  })

  it('appends override entries not already present with a synthesised variants map', () => {
    const entry = buildEntry('exp-new', [
      {
        type: 'EntryReplacement',
        baseline: { id: 'baseline-x' },
        variants: [{ id: 'variant-x-1' }],
      },
    ])
    const result = applyOptimizationOverrides([], { 'exp-new': OVERRIDE('exp-new', 1) }, [entry])
    expect(result).toEqual([
      {
        experienceId: 'exp-new',
        variantIndex: 1,
        variants: { 'baseline-x': 'variant-x-1' },
      },
    ])
  })

  it('skips non-EntryReplacement components silently', () => {
    const entry = buildEntry('exp-1', [
      {
        type: 'InlineVariable',
        key: 'flag',
        valueType: 'Boolean',
        baseline: { value: false },
        variants: [{ value: true }],
      },
      {
        type: 'EntryReplacement',
        baseline: { id: 'baseline-a' },
        variants: [{ id: 'variant-a-1' }],
      },
    ])
    const result = applyOptimizationOverrides(
      [{ experienceId: 'exp-1', variantIndex: 0, variants: {} }],
      { 'exp-1': OVERRIDE('exp-1', 1) },
      [entry],
    )
    expect(result[0]?.variants).toEqual({ 'baseline-a': 'variant-a-1' })
  })
})

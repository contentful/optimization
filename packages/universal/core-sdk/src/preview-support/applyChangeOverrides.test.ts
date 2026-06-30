import {
  type ChangeArray,
  isResolvedOptimizationEntry,
  type OptimizationEntry,
} from '@contentful/optimization-api-client/api-schemas'
import { applyChangeOverrides } from './applyChangeOverrides'
import type { OptimizationOverride } from './types'

function buildEntry(
  experienceId: string,
  key: string,
  baseline: unknown,
  variant: unknown,
): OptimizationEntry {
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
      nt_name: `Flag ${key}`,
      nt_type: 'nt_personalization',
      nt_experience_id: experienceId,
      nt_config: {
        components: [
          {
            type: 'InlineVariable',
            key,
            valueType: typeof baseline === 'boolean' ? 'Boolean' : 'Number',
            baseline: { value: baseline },
            variants: [{ value: variant }],
          },
        ],
        distribution: [0, 1],
      },
    },
  }

  if (!isResolvedOptimizationEntry(entry)) {
    throw new Error(`Expected ${experienceId} fixture to be a resolved optimization entry`)
  }

  return entry
}

const ENTRIES: readonly OptimizationEntry[] = [
  buildEntry('exp-1', 'flag-a', false, true),
  buildEntry('exp-2', 'flag-b', 0, 42),
]

const BASELINE_CHANGES: ChangeArray = [
  {
    key: 'flag-a',
    type: 'Variable',
    value: false,
    meta: { experienceId: 'exp-1', variantIndex: 0 },
  },
  { key: 'flag-b', type: 'Variable', value: 0, meta: { experienceId: 'exp-2', variantIndex: 0 } },
]

const overrides = (record: Record<string, number>): Record<string, OptimizationOverride> =>
  Object.fromEntries(
    Object.entries(record).map(([experienceId, variantIndex]) => [
      experienceId,
      { experienceId, variantIndex },
    ]),
  )

describe('applyChangeOverrides', () => {
  it('returns the input array unchanged when no overrides are provided', () => {
    const result = applyChangeOverrides(BASELINE_CHANGES, ENTRIES, {})
    expect(result).toBe(BASELINE_CHANGES)
  })

  it('translates variant overrides into Variable changes for inline-variable components', () => {
    const result = applyChangeOverrides(BASELINE_CHANGES, ENTRIES, overrides({ 'exp-1': 1 }))
    expect(result.find((c) => c.key === 'flag-a')?.value).toBe(true)
    expect(result.find((c) => c.key === 'flag-a')?.meta.variantIndex).toBe(1)
    // Untouched override leaves flag-b alone.
    expect(result.find((c) => c.key === 'flag-b')?.value).toBe(0)
  })

  it('falls back to baseline value when the override variantIndex points past the variants array', () => {
    const result = applyChangeOverrides(BASELINE_CHANGES, ENTRIES, overrides({ 'exp-1': 99 }))
    // No variant at index 98 → baseline value re-emitted.
    expect(result.find((c) => c.key === 'flag-a')?.value).toBe(false)
  })

  it('emits the baseline value for variantIndex 0', () => {
    // Pretend the baseline was already overridden to variant 1 in the baseline-changes
    // payload, then drop back to 0 via override.
    const baselineWithVariantApplied: ChangeArray = [
      {
        key: 'flag-a',
        type: 'Variable',
        value: true,
        meta: { experienceId: 'exp-1', variantIndex: 1 },
      },
    ]
    const result = applyChangeOverrides(
      baselineWithVariantApplied,
      ENTRIES,
      overrides({ 'exp-1': 0 }),
    )
    expect(result.find((c) => c.key === 'flag-a')?.value).toBe(false)
  })

  it('returns the input unchanged when overrides exist but no entries have inline-variable components', () => {
    const result = applyChangeOverrides(BASELINE_CHANGES, [], overrides({ 'exp-1': 1 }))
    expect(result).toBe(BASELINE_CHANGES)
  })
})

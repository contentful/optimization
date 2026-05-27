import type { SourceMap } from '@contentful/optimization-core/api-schemas'
import { describe, expect, it } from '@rstest/core'
import { resolveNodeViewPayload } from './resolveNodeViewPayload'

const SOURCE_MAP: SourceMap = {
  variants: [
    { type: 'personalization', id: 'default' },
    { type: 'personalization', id: 'variant-a' },
  ],
  layers: [
    { kind: 'Experience', id: 'exp-id', variants: [1] },
    { kind: 'Fragment', id: 'frag-id', variants: [0] },
  ],
  nodes: {
    'node-exp': { layers: [0], scope: 0 },
    'node-frag': { layers: [1, 0], scope: 1 },
    'node-no-scope-variants': { layers: [1], scope: 1 },
  },
}

describe('resolveNodeViewPayload', () => {
  it('resolves metadata for a node scoped to an Experience layer', () => {
    const result = resolveNodeViewPayload('node-exp', SOURCE_MAP)

    expect(result).toEqual({
      entityId: 'exp-id',
      entityKind: 'Experience',
      optimizationId: 'exp-id',
      variantId: 'variant-a',
      parentExperienceId: undefined,
    })
  })

  it('resolves metadata for a node scoped to a Fragment layer', () => {
    const result = resolveNodeViewPayload('node-frag', SOURCE_MAP)

    expect(result).toEqual({
      entityId: 'frag-id',
      entityKind: 'Fragment',
      optimizationId: 'frag-id',
      variantId: 'default',
      parentExperienceId: 'exp-id',
    })
  })

  it('returns undefined when nodeId is not in sourceMap', () => {
    const result = resolveNodeViewPayload('nonexistent', SOURCE_MAP)

    expect(result).toBeUndefined()
  })

  it('returns undefined when scope layer has no variants', () => {
    const sourceMapNoVariants: SourceMap = {
      variants: [],
      layers: [{ kind: 'Fragment', id: 'frag-id' }],
      nodes: { 'node-1': { layers: [0], scope: 0 } },
    }

    const result = resolveNodeViewPayload('node-1', sourceMapNoVariants)

    expect(result).toBeUndefined()
  })

  it('skips scope layer without variants and falls through to next layer', () => {
    const mixedSourceMap: SourceMap = {
      variants: [{ type: 'personalization', id: 'variant-b' }],
      layers: [
        { kind: 'Fragment', id: 'frag-no-variants' },
        { kind: 'Experience', id: 'exp-id', variants: [0] },
      ],
      nodes: {
        'node-1': { layers: [0, 1], scope: 0 },
      },
    }

    const result = resolveNodeViewPayload('node-1', mixedSourceMap)

    expect(result).toEqual({
      entityId: 'exp-id',
      entityKind: 'Experience',
      optimizationId: 'exp-id',
      variantId: 'variant-b',
      parentExperienceId: undefined,
    })
  })

  it('does not use unrelated global layers outside the node layer chain', () => {
    const sourceMapWithUnrelatedLayer: SourceMap = {
      variants: [{ type: 'personalization', id: 'variant-c' }],
      layers: [
        { kind: 'Fragment', id: 'frag-no-variants' },
        { kind: 'Experience', id: 'unrelated-exp', variants: [0] },
      ],
      nodes: {
        'node-1': { layers: [0], scope: 0 },
      },
    }

    const result = resolveNodeViewPayload('node-1', sourceMapWithUnrelatedLayer)

    expect(result).toBeUndefined()
  })

  it('returns undefined when layer kind is not a known entity kind', () => {
    const unknownKindSourceMap: SourceMap = {
      variants: [{ type: 'personalization', id: 'v' }],
      layers: [{ kind: 'Unknown', id: 'unknown-id', variants: [0] }],
      nodes: { 'node-1': { layers: [0], scope: 0 } },
    }

    const result = resolveNodeViewPayload('node-1', unknownKindSourceMap)

    expect(result).toBeUndefined()
  })

  it('sets parentExperienceId to the nearest ancestor Experience layer above the attributed layer', () => {
    const nestedSourceMap: SourceMap = {
      variants: [{ type: 'personalization', id: 'variant-x' }],
      layers: [
        { kind: 'Fragment', id: 'frag-id', variants: [0] },
        { kind: 'Experience', id: 'parent-exp-id' },
      ],
      nodes: {
        'node-1': { layers: [0, 1], scope: 0 },
      },
    }

    const result = resolveNodeViewPayload('node-1', nestedSourceMap)

    expect(result?.parentExperienceId).toBe('parent-exp-id')
    expect(result?.entityId).toBe('frag-id')
  })
})

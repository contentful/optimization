import { describe, expect, it } from '@rstest/core'
import { SourceMap } from './SourceMap'

const VALID_SOURCE_MAP = {
  variants: [
    { type: 'personalization', id: 'default' },
    { type: 'personalization', id: 'variant-a' },
  ],
  layers: [
    { kind: 'Experience', id: 'exp-id', variants: [1] },
    { kind: 'Fragment', id: 'frag-id' },
  ],
  nodes: {
    'node-1': { layers: [0], scope: 0 },
    'node-2': { layers: [1, 0], scope: 1 },
  },
}

describe('SourceMap schema', () => {
  it('accepts a valid sourceMap', () => {
    const result = SourceMap.safeParse(VALID_SOURCE_MAP)

    expect(result.success).toBe(true)
  })

  it('accepts explicit optimization metadata on variants', () => {
    const result = SourceMap.safeParse({
      ...VALID_SOURCE_MAP,
      variants: [
        { type: 'personalization', id: 'default' },
        {
          type: 'personalization',
          id: 'variant-a',
          experienceId: 'exp-id',
          optimizationId: 'opt-id',
          variantId: 'variant-a',
          variantIndex: 1,
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it('accepts layers without variants', () => {
    const result = SourceMap.safeParse({
      ...VALID_SOURCE_MAP,
      layers: [{ kind: 'Fragment', id: 'frag-id' }],
    })

    expect(result.success).toBe(true)
  })

  it('rejects missing nodes map', () => {
    const { nodes: _removed, ...withoutNodes } = VALID_SOURCE_MAP
    const result = SourceMap.safeParse(withoutNodes)

    expect(result.success).toBe(false)
  })

  it('rejects node missing scope', () => {
    const result = SourceMap.safeParse({
      ...VALID_SOURCE_MAP,
      nodes: { 'node-1': { layers: [0] } },
    })

    expect(result.success).toBe(false)
  })

  it('accepts an empty variants array', () => {
    const result = SourceMap.safeParse({ ...VALID_SOURCE_MAP, variants: [] })

    expect(result.success).toBe(true)
  })
})

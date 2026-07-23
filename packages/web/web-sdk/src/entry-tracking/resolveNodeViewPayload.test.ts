import {
  SourceMap,
  type SourceMapLayer,
  type SourceMapNode,
  type SourceMapVariant,
} from '@contentful/optimization-core/api-schemas'
import { describe, expect, it } from '@rstest/core'
import { resolveNodeViewPayload } from './resolveNodeViewPayload'

function makeSourceMap(input: {
  variants?: SourceMapVariant[]
  layers?: SourceMapLayer[]
  nodes?: Record<string, SourceMapNode>
}): SourceMap {
  return SourceMap.parse({
    version: 1,
    variants: input.variants ?? [],
    spaces: [],
    environments: [],
    locales: [],
    entries: [],
    assets: [],
    layers: input.layers ?? [],
    dataAssemblies: [],
    nodes: input.nodes ?? {},
  })
}

function node(layers: number[], scope: number): SourceMapNode {
  return { layers, scope, contentProperties: [] }
}

describe('resolveNodeViewPayload', () => {
  it('resolves metadata for a node scoped to an Experience layer', () => {
    const sourceMap = makeSourceMap({
      variants: [
        { type: 'personalization', id: 'default' },
        { type: 'personalization', id: 'variant-a' },
      ],
      layers: [
        { kind: 'Experience', id: 'exp-id', variants: [1] },
        { kind: 'Fragment', id: 'frag-id', variants: [0] },
      ],
      nodes: {
        'node-exp': node([0], 0),
        'node-frag': node([1, 0], 1),
      },
    })

    const result = resolveNodeViewPayload('node-exp', sourceMap)

    expect(result).toEqual({
      entityId: 'exp-id',
      entityKind: 'Experience',
      optimizationId: 'exp-id',
      variantId: 'variant-a',
      variantIndex: 1,
      parentExperienceId: undefined,
    })
  })

  it('prefers explicit variant metadata from sourceMap variants', () => {
    const sourceMap = makeSourceMap({
      variants: [
        { type: 'personalization', id: 'default' },
        {
          type: 'personalization',
          id: 'variant-entry-id',
          experienceId: 'exp-id',
          optimizationId: 'opt-id',
          variantId: 'variant-a',
          variantIndex: 1,
        },
      ],
      layers: [{ kind: 'Experience', id: 'exp-id', variants: [1] }],
      nodes: { 'node-1': node([0], 0) },
    })

    const result = resolveNodeViewPayload('node-1', sourceMap)

    expect(result).toEqual({
      entityId: 'exp-id',
      entityKind: 'Experience',
      optimizationId: 'opt-id',
      variantId: 'variant-a',
      variantIndex: 1,
      parentExperienceId: undefined,
    })
  })

  it('resolves metadata for a node scoped to a Fragment layer', () => {
    const sourceMap = makeSourceMap({
      variants: [
        { type: 'personalization', id: 'default' },
        { type: 'personalization', id: 'variant-a' },
      ],
      layers: [
        { kind: 'Experience', id: 'exp-id', variants: [1] },
        { kind: 'Fragment', id: 'frag-id', variants: [0] },
      ],
      nodes: {
        'node-frag': node([1, 0], 1),
      },
    })

    const result = resolveNodeViewPayload('node-frag', sourceMap)

    expect(result).toEqual({
      entityId: 'frag-id',
      entityKind: 'Fragment',
      optimizationId: 'frag-id',
      variantId: 'default',
      variantIndex: 0,
      parentExperienceId: 'exp-id',
    })
  })

  it('returns null when nodeId is not in sourceMap', () => {
    const sourceMap = makeSourceMap({
      variants: [{ type: 'personalization', id: 'default' }],
      layers: [{ kind: 'Experience', id: 'exp-id', variants: [0] }],
      nodes: { 'node-1': node([0], 0) },
    })

    expect(resolveNodeViewPayload('nonexistent', sourceMap)).toBeNull()
  })

  it('returns null when the scope layer index is not present in the node layer chain', () => {
    const sourceMap = makeSourceMap({
      variants: [{ type: 'personalization', id: 'default' }],
      layers: [{ kind: 'Experience', id: 'exp-id', variants: [0] }],
      nodes: { 'node-1': node([0], 99) },
    })

    expect(resolveNodeViewPayload('node-1', sourceMap)).toBeNull()
  })

  it('skips scope layer without a resolved variantId and falls through to the next layer', () => {
    const sourceMap = makeSourceMap({
      variants: [
        { type: 'personalization', id: 'default' },
        { type: 'personalization', id: 'variant-b' },
      ],
      layers: [
        // No variant reference on this fragment — .variants[0] === undefined → no variantId.
        { kind: 'Fragment', id: 'frag-no-variants', variants: [] },
        { kind: 'Experience', id: 'exp-id', variants: [1] },
      ],
      nodes: {
        'node-1': node([0, 1], 0),
      },
    })

    const result = resolveNodeViewPayload('node-1', sourceMap)

    expect(result).toEqual({
      entityId: 'exp-id',
      entityKind: 'Experience',
      optimizationId: 'exp-id',
      variantId: 'variant-b',
      variantIndex: 1,
      parentExperienceId: undefined,
    })
  })

  it('does not use unrelated global layers outside the node layer chain', () => {
    const sourceMap = makeSourceMap({
      variants: [
        { type: 'personalization', id: 'default' },
        { type: 'personalization', id: 'variant-c' },
      ],
      layers: [
        { kind: 'Fragment', id: 'frag-no-variants', variants: [] },
        { kind: 'Experience', id: 'unrelated-exp', variants: [1] },
      ],
      nodes: {
        'node-1': node([0], 0),
      },
    })

    expect(resolveNodeViewPayload('node-1', sourceMap)).toBeNull()
  })

  it('returns null for non-attributable layer kinds (InlineFragment, Slot, Template, ComponentType)', () => {
    const sourceMap = makeSourceMap({
      variants: [{ type: 'personalization', id: 'v' }],
      layers: [
        { kind: 'InlineFragment', id: 'inline-frag-id' },
        { kind: 'Slot', id: 'slot-id' },
        { kind: 'Template', id: 'template-id' },
        { kind: 'ComponentType', id: 'component-type-id' },
      ],
      nodes: {
        'node-inline': node([0], 0),
        'node-slot': node([1], 1),
        'node-template': node([2], 2),
        'node-component': node([3], 3),
      },
    })

    expect(resolveNodeViewPayload('node-inline', sourceMap)).toBeNull()
    expect(resolveNodeViewPayload('node-slot', sourceMap)).toBeNull()
    expect(resolveNodeViewPayload('node-template', sourceMap)).toBeNull()
    expect(resolveNodeViewPayload('node-component', sourceMap)).toBeNull()
  })

  it('sets parentExperienceId to the nearest ancestor Experience layer above the attributed layer', () => {
    const sourceMap = makeSourceMap({
      variants: [
        { type: 'personalization', id: 'default' },
        { type: 'personalization', id: 'variant-x' },
      ],
      layers: [
        { kind: 'Fragment', id: 'frag-id', variants: [1] },
        { kind: 'Experience', id: 'parent-exp-id', variants: [] },
      ],
      nodes: {
        'node-1': node([0, 1], 0),
      },
    })

    const result = resolveNodeViewPayload('node-1', sourceMap)

    expect(result?.parentExperienceId).toBe('parent-exp-id')
    expect(result?.entityId).toBe('frag-id')
    expect(result?.entityKind).toBe('Fragment')
    expect(result?.variantIndex).toBe(1)
  })
})

import type { SourceMap } from '@contentful/optimization-web/api-schemas'
import { describe, expect, it } from '@rstest/core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useOptimizedNode, type UseOptimizedNodeResult } from './useOptimizedNode'

const SOURCE_MAP: SourceMap = {
  variants: [
    { type: 'personalization', id: 'default' },
    { type: 'personalization', id: 'variant-a' },
  ],
  layers: [{ kind: 'Experience', id: 'exp-id', variants: [1] }],
  nodes: {
    'node-1': { layers: [0], scope: 0 },
  },
}

function renderHook(
  nodeId: string,
  sourceMap: SourceMap,
): { getResult: () => UseOptimizedNodeResult; cleanup: () => void } {
  let captured: UseOptimizedNodeResult | undefined = undefined
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  function Probe(): null {
    captured = useOptimizedNode({ nodeId, sourceMap })
    return null
  }

  act(() => {
    root.render(<Probe />)
  })

  return {
    getResult() {
      if (!captured) throw new Error('hook result not captured')
      return captured
    },
    cleanup() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('useOptimizedNode', () => {
  it('resolves payload when node is in sourceMap', () => {
    const { cleanup, getResult } = renderHook('node-1', SOURCE_MAP)

    expect(getResult().payload).toEqual({
      entityId: 'exp-id',
      entityKind: 'Experience',
      optimizationId: 'exp-id',
      variantId: 'variant-a',
      variantIndex: 1,
      parentExperienceId: undefined,
    })

    cleanup()
  })

  it('returns undefined payload when nodeId is absent from sourceMap', () => {
    const { cleanup, getResult } = renderHook('nonexistent', SOURCE_MAP)

    expect(getResult().payload).toBeUndefined()

    cleanup()
  })

  it('stamps dataset attributes when ref is called with an element', () => {
    const { cleanup, getResult } = renderHook('node-1', SOURCE_MAP)
    const el = document.createElement('div')

    act(() => {
      getResult().ref(el)
    })

    expect(el.dataset.ctflNodeId).toBe('node-1')
    expect(el.dataset.ctflEntityId).toBe('exp-id')
    expect(el.dataset.ctflEntityKind).toBe('Experience')
    expect(el.dataset.ctflOptimizationId).toBe('exp-id')
    expect(el.dataset.ctflVariant).toBe('variant-a')
    expect(el.dataset.ctflVariantIndex).toBe('1')

    cleanup()
  })

  it('clears node-view dataset attributes when payload is undefined', () => {
    const { cleanup, getResult } = renderHook('nonexistent', SOURCE_MAP)
    const el = document.createElement('div')
    el.dataset.ctflNodeId = 'previous-node'
    el.dataset.ctflEntityId = 'previous-entity'
    el.dataset.ctflEntityKind = 'Experience'
    el.dataset.ctflEntityKindId = 'previous-entity'
    el.dataset.ctflEntryIds = 'a,b'
    el.dataset.ctflLayers = '[]'
    el.dataset.ctflOptimizationId = 'previous-optimization'
    el.dataset.ctflParentExperienceId = 'previous-parent'
    el.dataset.ctflVariant = 'previous-variant'
    el.dataset.ctflVariantIndex = '2'

    act(() => {
      getResult().ref(el)
    })

    expect(el.dataset.ctflNodeId).toBeUndefined()
    expect(el.dataset.ctflEntityId).toBeUndefined()
    expect(el.dataset.ctflEntityKind).toBeUndefined()
    expect(el.dataset.ctflEntityKindId).toBeUndefined()
    expect(el.dataset.ctflEntryIds).toBeUndefined()
    expect(el.dataset.ctflLayers).toBeUndefined()
    expect(el.dataset.ctflOptimizationId).toBeUndefined()
    expect(el.dataset.ctflParentExperienceId).toBeUndefined()
    expect(el.dataset.ctflVariant).toBeUndefined()
    expect(el.dataset.ctflVariantIndex).toBeUndefined()

    cleanup()
  })

  it('ref is a no-op when called with null', () => {
    const { cleanup, getResult } = renderHook('node-1', SOURCE_MAP)
    const { ref } = getResult()

    expect(() => {
      ref(null)
    }).not.toThrow()

    cleanup()
  })
})

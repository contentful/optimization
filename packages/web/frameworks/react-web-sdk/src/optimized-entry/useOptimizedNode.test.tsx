import type { SourceMap } from '@contentful/optimization-web/api-schemas'
import { describe, expect, it } from '@rstest/core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useOptimizedNode, type UseOptimizedNodeResult } from './useOptimizedNode'

const SOURCE_MAP: SourceMap = {
  variants: [{ type: 'personalization', id: 'variant-a' }],
  layers: [{ kind: 'Experience', id: 'exp-id', variants: [0] }],
  nodes: {
    'node-1': { layers: [0], scope: 0 },
  },
}

function renderHook(
  nodeId: string,
  sourceMap: SourceMap,
): { getResult: () => UseOptimizedNodeResult; container: HTMLElement } {
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
    container,
  }
}

describe('useOptimizedNode', () => {
  it('resolves payload when node is in sourceMap', () => {
    const { getResult } = renderHook('node-1', SOURCE_MAP)

    expect(getResult().payload).toEqual({
      entityId: 'exp-id',
      entityKind: 'Experience',
      optimizationId: 'exp-id',
      variant: 'variant-a',
    })
  })

  it('returns undefined payload when nodeId is absent from sourceMap', () => {
    const { getResult } = renderHook('nonexistent', SOURCE_MAP)

    expect(getResult().payload).toBeUndefined()
  })

  it('stamps dataset attributes when ref is called with an element', () => {
    const { getResult } = renderHook('node-1', SOURCE_MAP)
    const el = document.createElement('div')

    act(() => {
      getResult().ref(el)
    })

    expect(el.dataset.ctflNodeId).toBe('node-1')
    expect(el.dataset.ctflEntityId).toBe('exp-id')
    expect(el.dataset.ctflEntityKind).toBe('Experience')
    expect(el.dataset.ctflOptimizationId).toBe('exp-id')
    expect(el.dataset.ctflVariant).toBe('variant-a')
  })

  it('ref is a no-op when payload is undefined', () => {
    const { getResult } = renderHook('nonexistent', SOURCE_MAP)
    const el = document.createElement('div')

    act(() => {
      getResult().ref(el)
    })

    expect(el.dataset.ctflNodeId).toBeUndefined()
  })

  it('ref is a no-op when called with null', () => {
    const { getResult } = renderHook('node-1', SOURCE_MAP)
    const { ref } = getResult()

    expect(() => { ref(null) }).not.toThrow()
  })
})

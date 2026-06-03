import { describe, expect, it } from '@rstest/core'
import { createNodeViewDetector, type NodeViewTrackingCore } from './createNodeViewDetector'

function makeElement(dataset: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('div')
  for (const [key, value] of Object.entries(dataset)) {
    el.dataset[key] = value
  }
  return el
}

function makeCore(): { trackNodeView: ReturnType<typeof rs.fn>; core: NodeViewTrackingCore } {
  const trackNodeView = rs.fn<NodeViewTrackingCore['trackNodeView']>().mockResolvedValue(undefined)
  return { trackNodeView, core: { trackNodeView } }
}

describe('createNodeViewDetector', () => {
  it('returns observe/unobserve/disconnect', () => {
    const { core } = makeCore()
    const detector = createNodeViewDetector(core)

    expect(typeof detector.observe).toBe('function')
    expect(typeof detector.unobserve).toBe('function')
    expect(typeof detector.disconnect).toBe('function')
  })

  it('does not throw when disconnected before any observation', () => {
    const { core } = makeCore()
    const detector = createNodeViewDetector(core)

    expect(() => {
      detector.disconnect()
    }).not.toThrow()
  })

  it('does not call trackNodeView when required dataset attributes are missing', () => {
    const { core, trackNodeView } = makeCore()
    const detector = createNodeViewDetector(core, { dwellTimeMs: 0 })
    const el = makeElement({ ctflNodeId: 'node-1' })

    detector.observe(el)
    detector.unobserve(el)

    expect(trackNodeView).not.toHaveBeenCalled()
  })

  it('does not call trackNodeView for unknown entityKind in dataset', () => {
    const { core, trackNodeView } = makeCore()
    const detector = createNodeViewDetector(core, { dwellTimeMs: 0 })
    const el = makeElement({
      ctflNodeId: 'node-1',
      ctflEntityId: 'exp-id',
      ctflEntityKind: 'Unknown',
      ctflOptimizationId: 'opt-id',
      ctflVariant: 'variant-a',
      ctflVariantIndex: '1',
    })

    detector.observe(el)
    detector.unobserve(el)

    expect(trackNodeView).not.toHaveBeenCalled()
  })
})

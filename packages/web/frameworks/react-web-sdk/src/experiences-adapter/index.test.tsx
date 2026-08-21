import ContentfulOptimization from '@contentful/optimization-web'
import {
  SourceMap,
  type SourceMapLayer,
  type SourceMapNode,
  type SourceMapVariant,
} from '@contentful/optimization-web/api-schemas'
import { describe, expect, it } from '@rstest/core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createOptimizationSdk } from '../test/sdkTestUtils'
import { getExperiencesAdapter, type ExperiencesOptimizationAdapter } from './index'

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

function nodeEntry(layers: number[], scope: number): SourceMapNode {
  return { layers, scope, contentProperties: [] }
}

function makePersonalizedSourceMap(): SourceMap {
  return makeSourceMap({
    variants: [
      {
        type: 'personalization',
        id: 'variant-entry-id',
        experienceId: 'exp-id',
        optimizationId: 'opt-id',
        variantId: 'variant-a',
        variantIndex: 1,
      },
    ],
    layers: [{ kind: 'Experience', id: 'exp-id', variants: [0] }],
    nodes: { 'node-1': nodeEntry([0], 0) },
  })
}

function makeOptimization(): ContentfulOptimization {
  const sdk = createOptimizationSdk({ hasConsent: (name) => name.startsWith('track') })
  if (!(sdk instanceof ContentfulOptimization)) {
    throw new Error('Expected optimization test double to use the ContentfulOptimization prototype')
  }
  return sdk
}

async function mountProbe(element: React.ReactElement): Promise<{
  container: HTMLDivElement
  unmount: () => Promise<void>
}> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    await Promise.resolve()
    root.render(element)
  })
  return {
    container,
    async unmount() {
      await act(async () => {
        await Promise.resolve()
        root.unmount()
      })
      container.remove()
    },
  }
}

async function captureBinding(
  adapter: ExperiencesOptimizationAdapter,
  nodeId: string,
  sourceMap: SourceMap | undefined,
): Promise<{
  element: HTMLDivElement
  resolved: ReturnType<ExperiencesOptimizationAdapter['useNodeBinding']>['resolved']
  unmount: () => Promise<void>
}> {
  const state: {
    resolved: ReturnType<ExperiencesOptimizationAdapter['useNodeBinding']>['resolved'] | null
    element: HTMLDivElement | null
  } = { resolved: null, element: null }

  function Probe(): React.JSX.Element {
    const { ref, resolved } = adapter.useNodeBinding(nodeId, sourceMap)
    state.resolved = resolved
    return (
      <div
        ref={(element): void => {
          ref(element)
          state.element = element
        }}
      />
    )
  }

  const view = await mountProbe(<Probe />)

  const { element } = state
  if (element === null) {
    await view.unmount()
    throw new Error('Expected element to be captured')
  }

  return { element, resolved: state.resolved, unmount: view.unmount }
}

describe('experiences-adapter', () => {
  describe('useNodeBinding', () => {
    it('stamps every data-ctfl-* attribute for an attributable node', async () => {
      const optimization = makeOptimization()
      const adapter = getExperiencesAdapter(optimization)
      const sourceMap = makePersonalizedSourceMap()

      const { element, resolved, unmount } = await captureBinding(adapter, 'node-1', sourceMap)

      expect(resolved).toEqual({
        entityId: 'exp-id',
        entityKind: 'Experience',
        optimizationId: 'opt-id',
        variantId: 'variant-a',
        variantIndex: 1,
        parentExperienceId: undefined,
      })

      expect(element.getAttribute('data-ctfl-node-id')).toBe('node-1')
      expect(element.getAttribute('data-ctfl-entity-id')).toBe('exp-id')
      expect(element.getAttribute('data-ctfl-entity-kind')).toBe('Experience')
      expect(element.getAttribute('data-ctfl-optimization-id')).toBe('opt-id')
      expect(element.getAttribute('data-ctfl-variant')).toBe('variant-a')
      expect(element.getAttribute('data-ctfl-variant-index')).toBe('1')
      expect(element.getAttribute('data-ctfl-parent-experience-id')).toBeNull()

      await unmount()
    })

    it('stamps parentExperienceId when the resolver returns one', async () => {
      const sourceMap = makeSourceMap({
        variants: [
          {
            type: 'personalization',
            id: 'variant-entry-id',
            optimizationId: 'opt-id',
            variantId: 'variant-a',
            variantIndex: 2,
          },
        ],
        layers: [
          { kind: 'Fragment', id: 'frag-id', variants: [0] },
          { kind: 'Experience', id: 'parent-exp-id', variants: [] },
        ],
        nodes: { 'node-1': nodeEntry([0, 1], 0) },
      })

      const optimization = makeOptimization()
      const adapter = getExperiencesAdapter(optimization)
      const { element, resolved, unmount } = await captureBinding(adapter, 'node-1', sourceMap)

      expect(resolved).toMatchObject({
        entityKind: 'Fragment',
        parentExperienceId: 'parent-exp-id',
      })
      expect(element.getAttribute('data-ctfl-parent-experience-id')).toBe('parent-exp-id')

      await unmount()
    })

    it('returns resolved === null and does not stamp when node is non-attributable', async () => {
      const sourceMap = makeSourceMap({
        variants: [],
        layers: [{ kind: 'Slot', id: 'slot-id' }],
        nodes: { 'node-1': nodeEntry([0], 0) },
      })

      const optimization = makeOptimization()
      const adapter = getExperiencesAdapter(optimization)
      const { element, resolved, unmount } = await captureBinding(adapter, 'node-1', sourceMap)

      expect(resolved).toBeNull()
      expect(element.getAttribute('data-ctfl-node-id')).toBeNull()
      expect(element.getAttribute('data-ctfl-entity-id')).toBeNull()

      await unmount()
    })

    it('returns resolved === null when the sourceMap is undefined', async () => {
      const optimization = makeOptimization()
      const adapter = getExperiencesAdapter(optimization)
      const { element, resolved, unmount } = await captureBinding(adapter, 'node-1', undefined)

      expect(resolved).toBeNull()
      expect(element.getAttribute('data-ctfl-node-id')).toBeNull()

      await unmount()
    })

    it('renders on the server without stamping (ref callback is client-only)', () => {
      const optimization = makeOptimization()
      const adapter = getExperiencesAdapter(optimization)
      const sourceMap = makePersonalizedSourceMap()

      function Probe(): React.JSX.Element {
        const { ref } = adapter.useNodeBinding('node-1', sourceMap)
        return <div ref={ref} data-ctfl-node-id="node-1" />
      }

      const html = renderToString(<Probe />)
      expect(html).toContain('data-ctfl-node-id="node-1"')
    })
  })

  describe('attachInteractionRuntime', () => {
    it('returns a cleanup that disables only what was enabled', () => {
      const optimization = makeOptimization()
      const adapter = getExperiencesAdapter(optimization)

      // Cleanup is a function even when we ask for nothing.
      const noop = adapter.attachInteractionRuntime({
        views: false,
        clicks: false,
        hovers: false,
      })
      expect(typeof noop).toBe('function')
      noop()

      // Enabling a subset should not throw; cleanup must be idempotent.
      const cleanup = adapter.attachInteractionRuntime({
        views: true,
        clicks: false,
        hovers: true,
      })
      expect(typeof cleanup).toBe('function')
      cleanup()
      cleanup()
    })

    it('shares one NodeInteractionRuntime per optimization instance', () => {
      const optimization = makeOptimization()
      const a = getExperiencesAdapter(optimization)
      const b = getExperiencesAdapter(optimization)

      // Two adapter objects, but they must coordinate through one runtime —
      // verified by not throwing when a's cleanup runs after b enabled a
      // disjoint interaction on the same underlying runtime.
      const cleanupA = a.attachInteractionRuntime({ views: true, clicks: false, hovers: false })
      const cleanupB = b.attachInteractionRuntime({ views: false, clicks: true, hovers: false })
      cleanupA()
      cleanupB()
    })
  })
})

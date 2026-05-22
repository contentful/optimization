import { useOptimizedNode, type UseOptimizedNodeParams } from '@contentful/optimization-react-web'
import type { JSX } from 'react'
import { useState } from 'react'

const EXPERIENCE_NODE_ID = 'demo-experience-node'
const FRAGMENT_NODE_ID = 'demo-fragment-node'

// layers[0] = Fragment (leaf), layers[1] = Experience (root)
const NODE_VIEW_DEMO_SOURCE_MAP: UseOptimizedNodeParams['sourceMap'] = {
  variants: [
    { type: 'personalization', id: 'demo-experience-variant' },
    { type: 'personalization', id: 'demo-fragment-variant' },
  ],
  layers: [
    { kind: 'Fragment', id: 'demo-fragment', variants: [1] },
    { kind: 'Experience', id: 'demo-experience', variants: [0] },
  ],
  nodes: {
    [EXPERIENCE_NODE_ID]: { layers: [1], scope: 1 },
    [FRAGMENT_NODE_ID]: { layers: [0, 1], scope: 0 },
  },
}

function formatPayload(
  payload:
    | { entityKind: string; entityId: string; variant: string; parentExperienceId?: string }
    | undefined,
): string {
  if (!payload) return 'unavailable'
  const base = `${payload.entityKind}:${payload.entityId}:${payload.variant}`
  return payload.parentExperienceId ? `${base} (parent: ${payload.parentExperienceId})` : base
}

export function NodeViewTrackingSection(): JSX.Element {
  const { payload: experiencePayload, ref: experienceRef } = useOptimizedNode({
    nodeId: EXPERIENCE_NODE_ID,
    sourceMap: NODE_VIEW_DEMO_SOURCE_MAP,
  })
  const { payload: fragmentPayload, ref: fragmentRef } = useOptimizedNode({
    nodeId: FRAGMENT_NODE_ID,
    sourceMap: NODE_VIEW_DEMO_SOURCE_MAP,
  })
  const [childCount, setChildCount] = useState(0)

  return (
    <section data-testid="node-view-section" style={{ display: 'grid', gap: 8 }}>
      <h2>Node View Tracking</h2>
      <p>
        Each tracked node emits an <code>exo_view</code> event. The Fragment carries a{' '}
        <code>parentExperienceId</code> to preserve the Experience → Fragment hierarchy.
      </p>

      <div
        ref={experienceRef}
        data-testid="node-view-experience"
        style={{ border: '1px solid #aaa', borderRadius: 4, padding: 12, display: 'grid', gap: 8 }}
      >
        <p>
          <strong>Experience node</strong>
        </p>
        <p data-testid="node-view-experience-payload">{formatPayload(experiencePayload)}</p>

        <div
          ref={fragmentRef}
          data-testid="node-view-target"
          style={{
            border: '1px dashed #777',
            borderRadius: 4,
            padding: 12,
            display: 'grid',
            gap: 8,
          }}
        >
          <p>
            <strong>Fragment node</strong>
          </p>
          <p data-testid="node-view-fragment-payload">{formatPayload(fragmentPayload)}</p>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              data-testid="node-view-add-child"
              onClick={() => {
                setChildCount((n) => n + 1)
              }}
              type="button"
            >
              Add child element
            </button>
            <button
              data-testid="node-view-clear-children"
              onClick={() => {
                setChildCount(0)
              }}
              type="button"
            >
              Clear
            </button>
          </div>

          {Array.from({ length: childCount }, (_, i) => (
            <p key={i} data-testid={`node-view-child-${i}`}>
              Child element {i + 1}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}

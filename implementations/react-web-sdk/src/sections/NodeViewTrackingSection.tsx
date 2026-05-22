import { useOptimizedNode, type UseOptimizedNodeParams } from '@contentful/optimization-react-web'
import type { JSX } from 'react'

const NODE_VIEW_DEMO_NODE_ID = 'home-node-view-demo-node'

const NODE_VIEW_DEMO_SOURCE_MAP: UseOptimizedNodeParams['sourceMap'] = {
  variants: [{ type: 'personalization', id: 'home-node-view-demo-variant' }],
  layers: [{ kind: 'Experience', id: 'home-node-view-demo-experience', variants: [0] }],
  nodes: {
    [NODE_VIEW_DEMO_NODE_ID]: {
      layers: [0],
      scope: 0,
    },
  },
}

export function NodeViewTrackingSection(): JSX.Element {
  const { payload, ref } = useOptimizedNode({
    nodeId: NODE_VIEW_DEMO_NODE_ID,
    sourceMap: NODE_VIEW_DEMO_SOURCE_MAP,
  })

  return (
    <section data-testid="node-view-section" style={{ display: 'grid', gap: 8 }}>
      <h2>Node View Tracking</h2>
      <p>
        This block uses <code>useOptimizedNode</code> to stamp node-view attributes for automatic{' '}
        <code>exo_view</code> tracking.
      </p>
      <div
        ref={ref}
        data-testid="node-view-target"
        style={{ border: '1px dashed #777', borderRadius: 4, padding: 12 }}
      >
        <p data-testid="node-view-payload">
          {payload
            ? `${payload.entityKind}:${payload.entityId}:${payload.variant}`
            : 'Node metadata unavailable'}
        </p>
      </div>
    </section>
  )
}

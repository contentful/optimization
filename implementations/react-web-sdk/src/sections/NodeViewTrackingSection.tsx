import type { JSX } from 'react'
import { useState } from 'react'

function NestedFragment({ isRoot = false }: { isRoot?: boolean }): JSX.Element {
  const [hasChild, setHasChild] = useState(false)

  return (
    <div
      data-ctfl-node-id="demo-fragment-node"
      data-ctfl-entity-id="demo-fragment"
      data-ctfl-entity-kind="Fragment"
      data-ctfl-optimization-id="demo-experience"
      data-ctfl-variant="demo-fragment-variant"
      data-ctfl-parent-experience-id="demo-experience"
      data-testid={isRoot ? 'node-view-target' : undefined}
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
      {!hasChild && (
        <button
          onClick={() => {
            setHasChild(true)
          }}
          type="button"
        >
          Add nested Fragment
        </button>
      )}
      {hasChild && <NestedFragment />}
    </div>
  )
}

export function NodeViewTrackingSection(): JSX.Element {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <h2>Node View Tracking</h2>
      <p>
        Each tracked node emits an <code>exo_view</code> event. The Fragment carries a{' '}
        <code>parentExperienceId</code> to preserve the Experience → Fragment hierarchy.
      </p>

      <div
        data-ctfl-node-id="demo-experience-node"
        data-ctfl-entity-id="demo-experience"
        data-ctfl-entity-kind="Experience"
        data-ctfl-optimization-id="demo-experience"
        data-ctfl-variant="demo-experience-variant"
        style={{ border: '1px solid #aaa', borderRadius: 4, padding: 12, display: 'grid', gap: 8 }}
      >
        <p>
          <strong>Experience node</strong>
        </p>

        <NestedFragment isRoot />
      </div>
    </section>
  )
}

import { resolveNodeViewPayload } from '@contentful/optimization-web'
import type { SourceMap } from '@contentful/optimization-web/api-schemas'
import { useMemo, type ElementType, type JSX, type ReactNode } from 'react'
import { useOptimizedNode } from './useOptimizedNode'

/**
 * Resource link payload pointing at the ComponentType definition for an
 * Experience node. The relevant id is the trailing segment of the
 * `componentTypes/<id>` portion of the urn. Inlined here rather than imported
 * from `@contentful/experiences-api-schemas`, which is not a public package.
 *
 * @public
 */
export interface ExperienceComponentTypeLink {
  sys: {
    type: 'ResourceLink'
    linkType: 'Contentful:ComponentType'
    urn: string
  }
}

/**
 * Minimal shape of a hydrated Experience tree node as returned by the
 * delivery/view synthesis pipeline. Only the fields {@link OptimizedExperience}
 * actually consumes are required; consumers may extend with additional fields.
 *
 * @public
 */
export interface ExperienceTreeNode {
  id?: string
  componentType: ExperienceComponentTypeLink
  contentProperties?: Record<string, unknown>
  designProperties?: Record<string, Record<string, unknown>>
  slots?: Record<string, ExperienceTreeNode[]>
}

/**
 * Map of `componentType` id (the trailing urn segment) to the React component
 * that should render nodes of that type. Components receive the merged content
 * + design property bag as props, plus `children` when the node has a
 * `children` slot.
 *
 * @public
 */
/**
 * `ElementType` accepts both coded components (`ComponentType<P>`) and
 * intrinsic tags (`"div"`, `"section"`, …); matches what host dispatch
 * tables typically already look like and avoids forcing per-call casts.
 */
export type ExperienceComponentMap = Record<string, ElementType>

/**
 * Props for the {@link OptimizedExperience} component.
 *
 * @public
 */
export interface OptimizedExperienceProps {
  /** Hydrated Experience tree returned by the personalized read path. */
  nodes: ExperienceTreeNode[]
  /** Source-map from `extensions.sourceMap` of the same response. */
  sourceMap?: SourceMap
  /** Lookup table mapping `componentType` ids to coded components. */
  componentMap: ExperienceComponentMap
  /**
   * Viewport key used to flatten `designProperties` into a single prop bag.
   * Each design property is a record keyed by viewport; we pick one value
   * here so coded components see plain props. Defaults to `"test-desktop"`
   * to match the current demo configuration.
   */
  viewportId?: string
  /**
   * Rendered when `componentMap` has no entry for a node's component type.
   * Defaults to `null` so unknown nodes are silently dropped. Pass a
   * component to surface placeholder UI during development.
   */
  renderUnsupported?: (params: { componentTypeId: string; node: ExperienceTreeNode }) => ReactNode
}

const EMPTY_SOURCE_MAP: SourceMap = { variants: [], layers: [], nodes: {} }

const COMPONENT_TYPE_URN_PATTERN = /\/componentTypes\/([^/]+)$/

function getComponentTypeId(node: ExperienceTreeNode): string {
  return COMPONENT_TYPE_URN_PATTERN.exec(node.componentType.sys.urn)?.[1] ?? ''
}

/**
 * Picks any leaf whose source-map attribution resolves to the Experience.
 * Its node id is fed to the outer wrapper so the resolver walks up to the
 * Experience layer and stamps Experience-attributed `data-ctfl-*` attributes
 * on a single host element.
 */
function findExperienceAttributedLeafId(
  nodes: ExperienceTreeNode[],
  sourceMap: SourceMap,
): string | undefined {
  for (const node of nodes) {
    if (node.id) {
      const payload = resolveNodeViewPayload(node.id, sourceMap)
      if (payload?.entityKind === 'Experience') {
        return node.id
      }
    }
    if (node.slots) {
      for (const slot of Object.values(node.slots)) {
        const found = findExperienceAttributedLeafId(slot, sourceMap)
        if (found) return found
      }
    }
  }
  return undefined
}

/**
 * Set of inner leaf ids whose attribution target is not the Experience,
 * deduplicated to one node id per unique `(entityKind, entityId)` pair. The
 * outer wrapper is the sole emitter for the Experience event; this set
 * ensures each non-Experience scope (a persisted Fragment, an inline
 * fragment, etc.) emits at most one view event no matter how many coded
 * leaves share it.
 */
function selectInnerFiringNodeIds(nodes: ExperienceTreeNode[], sourceMap: SourceMap): Set<string> {
  const seen = new Set<string>()
  const firing = new Set<string>()

  const visit = (items: ExperienceTreeNode[]): void => {
    for (const node of items) {
      if (node.id) {
        const payload = resolveNodeViewPayload(node.id, sourceMap)
        if (payload && payload.entityKind !== 'Experience') {
          const key = `${payload.entityKind}:${payload.entityId}`
          if (!seen.has(key)) {
            seen.add(key)
            firing.add(node.id)
          }
        }
      }
      if (node.slots) {
        for (const slot of Object.values(node.slots)) {
          visit(slot)
        }
      }
    }
  }

  visit(nodes)
  return firing
}

interface ExperienceWrapperProps {
  nodeId: string
  sourceMap: SourceMap
  children: ReactNode
}

function ExperienceWrapper({ nodeId, sourceMap, children }: ExperienceWrapperProps): JSX.Element {
  const { ref } = useOptimizedNode({ nodeId, sourceMap })
  return <div ref={ref as React.RefCallback<HTMLDivElement>}>{children}</div>
}

interface NodeViewProps {
  node: ExperienceTreeNode
  sourceMap: SourceMap
  firingNodeIds: Set<string>
  componentMap: ExperienceComponentMap
  viewportId: string
  renderUnsupported: OptimizedExperienceProps['renderUnsupported']
  parentId: string
  index: number
}

function NodeView({
  node,
  sourceMap,
  firingNodeIds,
  componentMap,
  viewportId,
  renderUnsupported,
  parentId,
  index,
}: NodeViewProps): ReactNode {
  // Inner leaves only stamp ids when this leaf is the dedup winner for its
  // attribution target; the Experience event itself is emitted by the outer
  // wrapper. Passing an empty id is the SDK's documented no-op signal — the
  // ref callback clears any prior attributes without registering observers.
  const sdkNodeId = node.id && firingNodeIds.has(node.id) ? node.id : ''
  const { ref } = useOptimizedNode({ nodeId: sdkNodeId, sourceMap })

  const componentTypeId = getComponentTypeId(node)
  const { [componentTypeId]: Component } = componentMap

  if (!Component) {
    return renderUnsupported ? <>{renderUnsupported({ componentTypeId, node })}</> : null
  }

  const resolvedDesignProperties = Object.entries(node.designProperties ?? {}).reduce<
    Record<string, unknown>
  >((acc, [key, byViewport]) => {
    const { [viewportId]: viewportValue } = byViewport
    acc[key] = viewportValue
    return acc
  }, {})

  const children = node.slots?.children?.map((child, childIndex) => (
    <NodeView
      key={`${child.id ?? getComponentTypeId(child)}-${node.id ?? componentTypeId}-${childIndex}`}
      node={child}
      sourceMap={sourceMap}
      firingNodeIds={firingNodeIds}
      componentMap={componentMap}
      viewportId={viewportId}
      renderUnsupported={renderUnsupported}
      parentId={node.id ?? componentTypeId}
      index={childIndex}
    />
  ))

  // The ref-bearing wrapper MUST have a real layout box: NodeViewRuntime's
  // IntersectionObserver only fires for elements with non-zero bounding
  // rects, and `display: contents` removes the box from layout.
  return (
    <div
      ref={ref as React.RefCallback<HTMLDivElement>}
      key={`${node.id ?? componentTypeId}-${parentId}-${index}`}
    >
      <Component {...resolvedDesignProperties} {...node.contentProperties}>
        {children}
      </Component>
    </div>
  )
}

/**
 * Render a hydrated personalized Experience tree end-to-end: tree walk,
 * component dispatch via {@link ExperienceComponentMap}, design/content prop
 * spread, and `data-ctfl-*` ref stamping that wires each node into the
 * `NodeViewRuntime` for automatic view-event emission.
 *
 * @remarks
 * The component fires exactly one view event for the Experience itself
 * (via an outer wrapper that resolves to the Experience attribution layer)
 * plus one event per unique non-Experience attribution target found in the
 * tree (e.g. each persisted Fragment), regardless of how many coded leaves
 * roll up to that target.
 *
 * Requires an `<OptimizationProvider>` ancestor to supply the global
 * `clientId` / `environment` / `autoTrackNodeInteraction` configuration —
 * this component handles only the per-Experience rendering and stamping.
 *
 * @public
 */
export function OptimizedExperience({
  nodes,
  sourceMap,
  componentMap,
  viewportId = 'test-desktop',
  renderUnsupported,
}: OptimizedExperienceProps): ReactNode {
  const resolvedSourceMap = sourceMap ?? EMPTY_SOURCE_MAP

  const experienceNodeId = useMemo(
    () => findExperienceAttributedLeafId(nodes, resolvedSourceMap),
    [nodes, resolvedSourceMap],
  )

  const firingNodeIds = useMemo(
    () => selectInnerFiringNodeIds(nodes, resolvedSourceMap),
    [nodes, resolvedSourceMap],
  )

  const tree = nodes.map((node, index) => (
    <NodeView
      key={`${node.id ?? getComponentTypeId(node)}-root-${index}`}
      node={node}
      sourceMap={resolvedSourceMap}
      firingNodeIds={firingNodeIds}
      componentMap={componentMap}
      viewportId={viewportId}
      renderUnsupported={renderUnsupported}
      parentId="root"
      index={index}
    />
  ))

  if (experienceNodeId) {
    return (
      <ExperienceWrapper nodeId={experienceNodeId} sourceMap={resolvedSourceMap}>
        {tree}
      </ExperienceWrapper>
    )
  }

  return <>{tree}</>
}

export default OptimizedExperience

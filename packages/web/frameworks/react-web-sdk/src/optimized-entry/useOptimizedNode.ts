import { resolveNodeViewPayload, type ResolvedNodeMetadata } from '@contentful/optimization-web'
import type { SourceMap } from '@contentful/optimization-web/api-schemas'
import { useCallback, useMemo } from 'react'

export type { ResolvedNodeMetadata }

const CTFL_ATTRS = [
  'data-ctfl-node-id',
  'data-ctfl-entity-id',
  'data-ctfl-entity-kind',
  'data-ctfl-entity-kind-id',
  'data-ctfl-entry-ids',
  'data-ctfl-layers',
  'data-ctfl-optimization-id',
  'data-ctfl-parent-experience-id',
  'data-ctfl-variant',
  'data-ctfl-variant-index',
] as const

function setOrRemoveAttr(
  element: HTMLElement | SVGElement,
  attr: string,
  value: string | undefined,
): void {
  if (value !== undefined) {
    element.setAttribute(attr, value)
  } else {
    element.removeAttribute(attr)
  }
}

export interface UseOptimizedNodeParams {
  /** Rendered node ID matching a key in `sourceMap.nodes`. */
  nodeId: string
  /** The `extensions.sourceMap` object from the XDA response. */
  sourceMap: SourceMap
}

export interface UseOptimizedNodeResult {
  /**
   * Ref callback to attach to the DOM element that should be observed for
   * viewport dwell. When called with a non-null element the function stamps the
   * resolved node-view dataset attributes onto the element so the
   * `NodeViewRuntime` can auto-detect it.
   *
   * @remarks
   * Pass this ref to the root element rendered for the node, e.g.:
   * ```tsx
   * const { ref } = useOptimizedNode({ nodeId, sourceMap })
   * return <div ref={ref}>{children}</div>
   * ```
   */
  ref: (element: HTMLElement | SVGElement | null) => void
  /**
   * Resolved node metadata or `undefined` when the node is absent or has no
   * attributable layer in the sourceMap.
   */
  payload: ResolvedNodeMetadata | undefined
}

/**
 * Resolve XDA sourceMap metadata for a rendered node and return a ref callback
 * that stamps the required `data-ctfl-*` attributes onto the host element.
 *
 * @remarks
 * The stamped attributes are detected by the `NodeViewRuntime` for automatic
 * `exo_node_view` viewport tracking — no manual tracking call is needed.
 *
 * When `payload` is `undefined` the ref callback is a no-op; the element will
 * not be tracked.
 *
 * @param params - {@link UseOptimizedNodeParams}
 * @returns {@link UseOptimizedNodeResult}
 *
 * @public
 */
export function useOptimizedNode({
  nodeId,
  sourceMap,
}: UseOptimizedNodeParams): UseOptimizedNodeResult {
  const payload = useMemo(() => resolveNodeViewPayload(nodeId, sourceMap), [nodeId, sourceMap])

  const ref = useCallback(
    (element: HTMLElement | SVGElement | null): void => {
      if (!element) {
        return
      }

      if (!payload) {
        for (const attr of CTFL_ATTRS) {
          element.removeAttribute(attr)
        }
        return
      }

      const {
        entityId,
        entityKind,
        entityKindId,
        entryIds,
        optimizationId,
        parentExperienceId,
        variantId,
        variantIndex,
      } = payload

      element.setAttribute('data-ctfl-node-id', nodeId)
      element.setAttribute('data-ctfl-entity-id', entityId)
      element.setAttribute('data-ctfl-entity-kind', entityKind)
      setOrRemoveAttr(element, 'data-ctfl-entity-kind-id', entityKindId)
      setOrRemoveAttr(element, 'data-ctfl-entry-ids', entryIds?.join(','))
      element.setAttribute('data-ctfl-optimization-id', optimizationId)
      setOrRemoveAttr(element, 'data-ctfl-parent-experience-id', parentExperienceId)
      element.setAttribute('data-ctfl-variant', variantId)
      element.setAttribute('data-ctfl-variant-index', String(variantIndex))
    },
    [nodeId, payload],
  )

  return { ref, payload }
}

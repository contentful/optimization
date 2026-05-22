import { resolveNodeViewPayload, type ResolvedNodeMetadata } from '@contentful/optimization-web'
import type { SourceMap } from '@contentful/optimization-web/api-schemas'
import { useCallback, useMemo } from 'react'

export type { ResolvedNodeMetadata }

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
 * `exo_view` viewport tracking — no manual tracking call is needed.
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
      if (!element) return
      const { dataset } = element

      if (!payload) {
        delete dataset.ctflNodeId
        delete dataset.ctflEntityId
        delete dataset.ctflEntityKind
        delete dataset.ctflEntityKindId
        delete dataset.ctflEntryIds
        delete dataset.ctflLayers
        delete dataset.ctflOptimizationId
        delete dataset.ctflParentExperienceId
        delete dataset.ctflVariant
        return
      }

      const {
        entityId,
        entityKind,
        entityKindId,
        entryIds,
        layers,
        optimizationId,
        parentExperienceId,
        variant,
      } = payload

      dataset.ctflNodeId = nodeId
      dataset.ctflEntityId = entityId
      dataset.ctflEntityKind = entityKind
      if (entityKindId !== undefined) dataset.ctflEntityKindId = entityKindId
      else delete dataset.ctflEntityKindId
      if (entryIds !== undefined) dataset.ctflEntryIds = entryIds.join(',')
      else delete dataset.ctflEntryIds
      if (layers !== undefined) dataset.ctflLayers = JSON.stringify(layers)
      else delete dataset.ctflLayers
      dataset.ctflOptimizationId = optimizationId
      if (parentExperienceId !== undefined) dataset.ctflParentExperienceId = parentExperienceId
      else delete dataset.ctflParentExperienceId
      dataset.ctflVariant = variant
    },
    [nodeId, payload],
  )

  return { ref, payload }
}

import type { NodeViewBuilderArgs } from '@contentful/optimization-core'
import type { SourceMap } from '@contentful/optimization-core/api-schemas'

/**
 * Subset of {@link NodeViewBuilderArgs} that can be resolved from a sourceMap
 * node entry, excluding timing fields that are supplied by the viewport
 * observer at fire time.
 *
 * @internal
 */
export type ResolvedNodeMetadata = Pick<
  NodeViewBuilderArgs,
  'entityId' | 'entityKind' | 'optimizationId' | 'variant'
>

const KNOWN_ENTITY_KINDS = new Set(['Experience', 'Fragment', 'InlineFragment', 'InlineComponent'])

function isKnownEntityKind(kind: string): kind is ResolvedNodeMetadata['entityKind'] {
  return KNOWN_ENTITY_KINDS.has(kind)
}

function resolveLayerAtIndex(
  layerIndex: number | undefined,
  layers: SourceMap['layers'],
  variants: SourceMap['variants'],
): ResolvedNodeMetadata | undefined {
  if (layerIndex === undefined) return undefined

  const { [layerIndex]: layer } = layers
  if (!layer?.variants?.length) return undefined

  const { [layer.variants[0] ?? -1]: variant } = variants
  if (variant === undefined) return undefined

  const { kind, id } = layer
  if (!isKnownEntityKind(kind)) return undefined

  return { entityId: id, entityKind: kind, optimizationId: id, variant: variant.id }
}

/**
 * Resolve node view metadata from an XDA `extensions.sourceMap` for a given
 * rendered node ID.
 *
 * @remarks
 * The function walks the node's `layers[]` chain (leaf-to-root), starting at
 * the position of the node's `scope` layer index (nearest ancestor Fragment or
 * Experience), and returns metadata for the first layer that has a `variants`
 * reference. If no such layer is found the node cannot be attributed and the
 * function returns `undefined`.
 *
 * @param nodeId - The rendered node ID to resolve, matching a key in
 *   `sourceMap.nodes`.
 * @param sourceMap - The `extensions.sourceMap` object from the XDA response.
 * @returns Resolved node metadata or `undefined` when the node is absent or
 *   has no attributable layer.
 *
 * @internal
 */
export function resolveNodeViewPayload(
  nodeId: string,
  sourceMap: SourceMap,
): ResolvedNodeMetadata | undefined {
  const { nodes, layers, variants } = sourceMap
  const { [nodeId]: node } = nodes
  if (node === undefined) return undefined

  const { layers: nodeLayers, scope } = node
  const scopePosition = nodeLayers.indexOf(scope)
  if (scopePosition < 0) return undefined

  for (let i = scopePosition; i < nodeLayers.length; i++) {
    const { [i]: layerIndex } = nodeLayers
    const resolved = resolveLayerAtIndex(layerIndex, layers, variants)
    if (resolved !== undefined) return resolved
  }

  return undefined
}

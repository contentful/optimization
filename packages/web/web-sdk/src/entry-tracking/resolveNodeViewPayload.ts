import type { NodeViewBuilderArgs } from '@contentful/optimization-core'
import type { ExoNodeLayer, SourceMap } from '@contentful/optimization-core/api-schemas'

/**
 * Subset of {@link NodeViewBuilderArgs} that can be resolved from a sourceMap
 * node entry, excluding timing fields that are supplied by the viewport
 * observer at fire time.
 *
 * @internal
 */
export type ResolvedNodeMetadata = Pick<
  NodeViewBuilderArgs,
  | 'entityId'
  | 'entityKind'
  | 'optimizationId'
  | 'variant'
  | 'entityKindId'
  | 'entryIds'
  | 'layers'
  | 'parentExperienceId'
>

const KNOWN_ENTITY_KINDS = new Set(['Experience', 'Fragment', 'InlineFragment', 'InlineComponent'])

function isKnownEntityKind(kind: string): kind is ResolvedNodeMetadata['entityKind'] {
  return KNOWN_ENTITY_KINDS.has(kind)
}

function resolveExoLayer(
  layerIndex: number | undefined,
  layers: SourceMap['layers'],
  variants: SourceMap['variants'],
): ExoNodeLayer | undefined {
  if (layerIndex === undefined) return undefined
  const { [layerIndex]: layer } = layers
  if (!layer) return undefined
  const { kind, id } = layer
  if (!isKnownEntityKind(kind)) return undefined

  const firstVariantIndex = layer.variants?.[0]
  const variantEntry = firstVariantIndex !== undefined ? variants[firstVariantIndex] : undefined
  const variant = variantEntry?.id
  const optimizationId = variantEntry !== undefined ? id : undefined

  return { entityKind: kind, entityId: id, variant, optimizationId }
}

function resolveLayerChain(
  nodeLayers: number[],
  scopePosition: number,
  layers: SourceMap['layers'],
  variants: SourceMap['variants'],
): ExoNodeLayer[] {
  const chain: ExoNodeLayer[] = []
  for (let i = scopePosition; i < nodeLayers.length; i++) {
    const { [i]: layerIndex } = nodeLayers
    const exoLayer = resolveExoLayer(layerIndex, layers, variants)
    if (exoLayer !== undefined) chain.push(exoLayer)
  }
  return chain
}

function findAttributableLayer(
  nodeLayers: number[],
  scopePosition: number,
  layers: SourceMap['layers'],
  variants: SourceMap['variants'],
): { layer: ExoNodeLayer; nodeIndex: number } | undefined {
  for (let i = scopePosition; i < nodeLayers.length; i++) {
    const { [i]: layerIndex } = nodeLayers
    const exoLayer = resolveExoLayer(layerIndex, layers, variants)
    if (exoLayer?.variant !== undefined) return { layer: exoLayer, nodeIndex: i }
  }
  return undefined
}

function findParentExperienceId(
  nodeLayers: number[],
  attributedLayerNodeIndex: number,
  layers: SourceMap['layers'],
): string | undefined {
  for (let i = attributedLayerNodeIndex + 1; i < nodeLayers.length; i++) {
    const { [i]: layerIndex } = nodeLayers
    const { [layerIndex ?? -1]: layer } = layers
    if (layer?.kind === 'Experience') return layer.id
  }
  return undefined
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

  const attributed = findAttributableLayer(nodeLayers, scopePosition, layers, variants)
  if (attributed === undefined) return undefined

  const layerChain = resolveLayerChain(nodeLayers, scopePosition, layers, variants)
  const parentExperienceId = findParentExperienceId(nodeLayers, attributed.nodeIndex, layers)

  return {
    entityId: attributed.layer.entityId,
    entityKind: attributed.layer.entityKind,
    optimizationId: attributed.layer.optimizationId ?? attributed.layer.entityId,
    variant: attributed.layer.variant ?? '',
    layers: layerChain.length > 0 ? layerChain : undefined,
    parentExperienceId,
  }
}

import type {
  SourceMap,
  SourceMapLayer,
  SourceMapVariant,
} from '@contentful/optimization-core/api-schemas'

/**
 * Metadata resolved for a rendered node inside a Ninetailed Experience/Fragment
 * subtree. Consumed by the ref-callback in
 * `@contentful/optimization-react-web/experiences-adapter` and stamped onto
 * the DOM as `data-ctfl-*` attributes.
 *
 * @remarks
 * Excludes timing fields (`viewId`, `viewDurationMs`) supplied by the viewport
 * observer at fire time.
 *
 * @internal
 */
export interface ResolvedNodeMetadata {
  entityId: string
  entityKind: 'Experience' | 'Fragment'
  optimizationId: string
  variantId: string
  variantIndex: number
  parentExperienceId?: string
}

const KNOWN_ENTITY_KINDS = new Set(['Experience', 'Fragment'])

interface AttributableLayer {
  entityKind: ResolvedNodeMetadata['entityKind']
  entityId: string
  optimizationId?: string
  variantId?: string
  variantIndex?: number
}

type AttributableSourceMapLayer = Extract<SourceMapLayer, { kind: 'Experience' | 'Fragment' }>

function isAttributableSourceMapLayer(layer: SourceMapLayer): layer is AttributableSourceMapLayer {
  return KNOWN_ENTITY_KINDS.has(layer.kind)
}

function resolveVariantIndex(
  variantEntry: SourceMapVariant,
  fallbackVariantIndex: number | undefined,
): number | undefined {
  if (variantEntry.variantIndex !== undefined) {
    return variantEntry.variantIndex
  }

  if (variantEntry.id === 'default') {
    return 0
  }

  return fallbackVariantIndex
}

function resolveVariantMetadata(
  variantEntry: SourceMapVariant | undefined,
  fallbackVariantIndex: number | undefined,
  fallbackOptimizationId: string,
): Pick<AttributableLayer, 'optimizationId' | 'variantId' | 'variantIndex'> {
  if (variantEntry === undefined) {
    return {}
  }

  return {
    variantId: variantEntry.variantId ?? variantEntry.id,
    variantIndex: resolveVariantIndex(variantEntry, fallbackVariantIndex),
    optimizationId: variantEntry.optimizationId ?? fallbackOptimizationId,
  }
}

function resolveAttributableLayer(
  layerIndex: number | undefined,
  layers: SourceMapLayer[],
  variants: SourceMapVariant[],
): AttributableLayer | undefined {
  if (layerIndex === undefined) {
    return undefined
  }

  const { [layerIndex]: layer } = layers
  if (!layer || !isAttributableSourceMapLayer(layer)) {
    return undefined
  }

  const { variants: layerVariants } = layer
  const { 0: firstVariantIndex } = layerVariants
  const variantEntry = firstVariantIndex !== undefined ? variants[firstVariantIndex] : undefined
  const variantMetadata = resolveVariantMetadata(variantEntry, firstVariantIndex, layer.id)

  return { entityKind: layer.kind, entityId: layer.id, ...variantMetadata }
}

function findAttributableLayer(
  nodeLayers: number[],
  scopePosition: number,
  layers: SourceMapLayer[],
  variants: SourceMapVariant[],
): { layer: AttributableLayer; nodeIndex: number } | undefined {
  for (let i = scopePosition; i < nodeLayers.length; i++) {
    const { [i]: layerIndex } = nodeLayers
    const attributable = resolveAttributableLayer(layerIndex, layers, variants)
    if (attributable?.variantId) {
      return { layer: attributable, nodeIndex: i }
    }
  }
  return undefined
}

function findParentExperienceId(
  nodeLayers: number[],
  attributedLayerNodeIndex: number,
  layers: SourceMapLayer[],
): string | undefined {
  for (let i = attributedLayerNodeIndex + 1; i < nodeLayers.length; i++) {
    const { [i]: layerIndex } = nodeLayers
    const { [layerIndex ?? -1]: layer } = layers
    if (layer?.kind === 'Experience') {
      return layer.id
    }
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
 * Experience), and returns metadata for the first layer that has a resolved
 * `variantId`. If no such layer is found the node cannot be attributed and the
 * function returns `null`.
 *
 * `KNOWN_ENTITY_KINDS` is narrowed to `Experience | Fragment` — the only
 * layer kinds that carry a `variants` reference in the shipped assemblies
 * contract.
 *
 * @param nodeId - The rendered node ID to resolve, matching a key in
 *   `sourceMap.nodes`.
 * @param sourceMap - The `extensions.sourceMap` object from the XDA response.
 * @returns Resolved node metadata or `null` when the node is absent or has no
 *   attributable layer.
 *
 * @internal
 */
export function resolveNodeViewPayload(
  nodeId: string,
  sourceMap: SourceMap,
): ResolvedNodeMetadata | null {
  const { nodes, layers, variants } = sourceMap
  const { [nodeId]: node } = nodes
  if (node === undefined) {
    return null
  }

  const { layers: nodeLayers, scope } = node
  const scopePosition = nodeLayers.indexOf(scope)
  if (scopePosition < 0) {
    return null
  }

  const attributed = findAttributableLayer(nodeLayers, scopePosition, layers, variants)
  if (attributed === undefined) {
    return null
  }

  const parentExperienceId = findParentExperienceId(nodeLayers, attributed.nodeIndex, layers)

  return {
    entityId: attributed.layer.entityId,
    entityKind: attributed.layer.entityKind,
    optimizationId: attributed.layer.optimizationId ?? attributed.layer.entityId,
    variantId: attributed.layer.variantId ?? '',
    variantIndex: attributed.layer.variantIndex ?? 0,
    parentExperienceId,
  }
}

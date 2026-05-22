import * as z from 'zod/mini'

/**
 * A single variant entry from the XDA `extensions.sourceMap.variants` array.
 *
 * @public
 */
export const SourceMapVariant = z.object({
  /**
   * Variant category, e.g. `'personalization'`.
   */
  type: z.string(),
  /**
   * Variant identifier, e.g. `'default'` or a variant sys.id.
   */
  id: z.string(),
})

/**
 * TypeScript type inferred from {@link SourceMapVariant}.
 *
 * @public
 */
export type SourceMapVariant = z.infer<typeof SourceMapVariant>

/**
 * A structural layer from the XDA `extensions.sourceMap.layers` array.
 *
 * @public
 */
export const SourceMapLayer = z.object({
  /**
   * Structural kind of the layer.
   *
   * @remarks
   * Possible values include `'Experience'`, `'Fragment'`,
   * `'InlineFragment'`, and `'InlineComponent'`.
   */
  kind: z.string(),
  /**
   * Contentful sys.id of the Experience or Fragment entry this layer
   * represents.
   */
  id: z.string(),
  /**
   * Optional indices into `SourceMap.variants[]` that apply to this layer.
   *
   * @remarks
   * Present only on layers that correspond to an optimization target.
   */
  variants: z.optional(z.array(z.number())),
})

/**
 * TypeScript type inferred from {@link SourceMapLayer}.
 *
 * @public
 */
export type SourceMapLayer = z.infer<typeof SourceMapLayer>

/**
 * Metadata for a single rendered node from the XDA
 * `extensions.sourceMap.nodes` map.
 *
 * @public
 */
export const SourceMapNode = z.object({
  /**
   * Leaf-to-root indices into `SourceMap.layers[]` for this node.
   */
  layers: z.array(z.number()),
  /**
   * Index of the nearest ancestor Fragment or Experience layer in
   * `SourceMap.layers[]`.
   */
  scope: z.number(),
})

/**
 * TypeScript type inferred from {@link SourceMapNode}.
 *
 * @public
 */
export type SourceMapNode = z.infer<typeof SourceMapNode>

/**
 * Zod schema for the `extensions.sourceMap` object returned in XDA
 * responses.
 *
 * @remarks
 * The sourceMap provides structural context for each rendered node,
 * enabling the SDK to resolve entity identity and variant selection
 * without additional server round-trips.
 *
 * @public
 */
export const SourceMap = z.object({
  /**
   * Flat list of variant entries referenced by layers.
   */
  variants: z.array(SourceMapVariant),
  /**
   * Flat list of structural layers ordered leaf-to-root.
   */
  layers: z.array(SourceMapLayer),
  /**
   * Map from rendered node ID to node metadata.
   */
  nodes: z.record(z.string(), SourceMapNode),
})

/**
 * TypeScript type inferred from {@link SourceMap}.
 *
 * @public
 */
export type SourceMap = z.infer<typeof SourceMap>

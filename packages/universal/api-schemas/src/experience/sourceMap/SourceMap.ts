import * as z from 'zod/mini'

/**
 * Header/opt-in constant for requesting `extensions.sourceMap` from XDA.
 *
 * @remarks
 * Setting either this header or `extensions.sourceMap: {}` on the request
 * body signals opt-in.
 *
 * @public
 */
export const EXTENSIONS_SOURCE_MAP_HEADER = 'x-contentful-extensions-sourcemap' as const

/**
 * Zod schema for a variant row in the source-map, currently only the
 * `personalization` type is emitted.
 *
 * @remarks
 * The wire authority is `@contentful/view-delivery-contract`; this schema is
 * a subset of it, covering only the fields read by
 * {@link resolveNodeViewPayload}.
 *
 * @public
 */
export const SourceMapVariant = z.object({
  type: z.literal('personalization'),
  id: z.string(),
  experienceId: z.optional(z.string()),
  optimizationId: z.optional(z.string()),
  variantId: z.optional(z.string()),
  variantIndex: z.optional(z.number()),
})

/**
 * TypeScript type inferred from {@link SourceMapVariant}.
 *
 * @public
 */
export type SourceMapVariant = z.infer<typeof SourceMapVariant>

/**
 * Zod schema for a layer row in the source-map. Discriminated on `kind`.
 *
 * @remarks
 * Only `Experience` and `Fragment` layers carry a `variants` reference and
 * are considered attributable by
 * {@link resolveNodeViewPayload}. The remaining kinds (`ComponentType`,
 * `Template`, `Slot`, `InlineFragment`) are accepted so `.parse` does not
 * fail on future-added fields.
 *
 * @public
 */
export const SourceMapLayer = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ComponentType'), id: z.string() }),
  z.object({ kind: z.literal('Template'), id: z.string() }),
  z.object({ kind: z.literal('Slot'), id: z.string() }),
  z.object({
    kind: z.literal('Experience'),
    id: z.string(),
    variants: z.array(z.number()),
    dataAssembly: z.optional(z.number()),
  }),
  z.object({
    kind: z.literal('Fragment'),
    id: z.string(),
    variants: z.array(z.number()),
    dataAssembly: z.optional(z.number()),
  }),
  z.object({
    kind: z.literal('InlineFragment'),
    id: z.string(),
    dataAssembly: z.optional(z.number()),
  }),
])

/**
 * TypeScript type inferred from {@link SourceMapLayer}.
 *
 * @public
 */
export type SourceMapLayer = z.infer<typeof SourceMapLayer>

/**
 * Zod schema for a per-hydrated-node mapping row.
 *
 * @remarks
 * `layers` runs leaf-to-root; `scope` indexes the nearest data-context
 * boundary layer used for entity-id attribution.
 *
 * @public
 */
export const SourceMapNode = z.object({
  layers: z.array(z.number()),
  scope: z.number(),
  contentProperties: z.array(z.unknown()),
})

/**
 * TypeScript type inferred from {@link SourceMapNode}.
 *
 * @public
 */
export type SourceMapNode = z.infer<typeof SourceMapNode>

/**
 * Zod schema for the top-level source-map payload. Field names mirror
 * `DeliveryViewSourceMapSchema` from `@contentful/view-delivery-contract` so
 * `.parse` will not fail on future-added fields; only `variants`, `layers`,
 * and `nodes` are read by consumers in this package.
 *
 * @public
 */
export const SourceMap = z.object({
  version: z.literal(1),
  variants: z.array(SourceMapVariant),
  spaces: z.array(z.string()),
  environments: z.array(z.string()),
  locales: z.array(z.string()),
  entries: z.array(z.unknown()),
  assets: z.array(z.unknown()),
  layers: z.array(SourceMapLayer),
  dataAssemblies: z.array(z.unknown()),
  nodes: z.record(z.string(), SourceMapNode),
})

/**
 * TypeScript type inferred from {@link SourceMap}.
 *
 * @public
 */
export type SourceMap = z.infer<typeof SourceMap>

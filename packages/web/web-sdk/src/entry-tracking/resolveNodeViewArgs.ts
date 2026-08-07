import type { NodeViewTrackingArgs } from '@contentful/optimization-core'
import type { ElementViewCallbackInfo } from './events/view/element-view-observer-support'
import { isHtmlOrSvgElement } from './isHtmlOrSvgElement'
import type { ResolvedNodeMetadata } from './resolveNodeViewPayload'

function isKnownEntityKind(kind: string): kind is ResolvedNodeMetadata['entityKind'] {
  return kind === 'Experience' || kind === 'Fragment'
}

function parseVariantIndex(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

/**
 * Metadata resolved off a node element's `data-ctfl-*` dataset. Excludes the
 * `viewId`/`viewDurationMs` fields the viewport observer supplies at fire time.
 *
 * @internal
 */
export type ResolvedNodeDataset = ResolvedNodeMetadata

/**
 * Read the `data-ctfl-*` dataset stamped by the `experiences-adapter` node
 * binding into a {@link ResolvedNodeDataset}. Returns `undefined` when required
 * attributes are missing or the entity kind is not one the SDK attributes to.
 *
 * @param element - Candidate DOM element carrying `data-ctfl-*` attributes.
 * @returns Resolved dataset metadata or `undefined` if the element is not
 *   attributable.
 *
 * @internal
 */
export function resolveNodeDataset(element: Element): ResolvedNodeDataset | undefined {
  if (!isHtmlOrSvgElement(element)) return undefined

  const { dataset } = element
  const {
    ctflNodeId,
    ctflEntityId,
    ctflEntityKind,
    ctflOptimizationId,
    ctflVariant,
    ctflVariantIndex,
    ctflParentExperienceId,
  } = dataset

  const variantIndex = parseVariantIndex(ctflVariantIndex)

  if (
    !ctflNodeId ||
    !ctflEntityId ||
    !ctflEntityKind ||
    !ctflOptimizationId ||
    !ctflVariant ||
    variantIndex === undefined
  ) {
    return undefined
  }

  if (!isKnownEntityKind(ctflEntityKind)) return undefined

  return {
    entityId: ctflEntityId,
    entityKind: ctflEntityKind,
    optimizationId: ctflOptimizationId,
    variantId: ctflVariant,
    variantIndex,
    parentExperienceId: ctflParentExperienceId,
  }
}

/**
 * Compose {@link NodeViewTrackingArgs} from an element's `data-ctfl-*` dataset
 * and the timing fields supplied by the viewport observer.
 *
 * @internal
 */
export function resolveNodeViewArgs(
  element: Element,
  info: ElementViewCallbackInfo,
): NodeViewTrackingArgs | undefined {
  const resolved = resolveNodeDataset(element)
  if (resolved === undefined) return undefined

  return {
    entityId: resolved.entityId,
    entityKind: resolved.entityKind,
    optimizationId: resolved.optimizationId,
    variantId: resolved.variantId,
    variantIndex: resolved.variantIndex,
    parentExperienceId: resolved.parentExperienceId,
    viewId: info.viewId,
    viewDurationMs: Math.max(0, Math.round(info.totalVisibleMs)),
  }
}

import type { NodeViewTrackingArgs } from '@contentful/optimization-core'
import { isHtmlOrSvgElement } from '../createTimedEntryDetector'
import type {
  ElementViewCallbackInfo,
  ElementViewObserverOptions,
} from './element-view-observer-support'
import ElementViewObserver from './ElementViewObserver'

/**
 * Minimal core interface required to track node view events.
 *
 * @internal
 */
export interface NodeViewTrackingCore {
  trackNodeView: (payload: NodeViewTrackingArgs) => Promise<void>
}

/**
 * A running node-view detector returned by {@link createNodeViewDetector}.
 *
 * @internal
 */
export interface NodeViewDetector {
  /** Begin observing an element for viewport dwell. */
  observe: (element: Element) => void
  /** Stop observing an element. */
  unobserve: (element: Element) => void
  /** Disconnect and release all resources. */
  disconnect: () => void
}

function parseBooleanOverride(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return undefined
}

function isKnownEntityKind(kind: string): kind is NodeViewTrackingArgs['entityKind'] {
  return (
    kind === 'Experience' ||
    kind === 'Fragment' ||
    kind === 'InlineFragment' ||
    kind === 'InlineComponent'
  )
}

function parseEntryIds(value: string | undefined): string[] | undefined {
  if (!value?.trim()) {
    return undefined
  }
  const ids = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return ids.length > 0 ? ids : undefined
}

function parseVariantIndex(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined

  const n = Number(value)
  return Number.isSafeInteger(n) ? n : undefined
}

function resolveNodeViewDataset(dataset: DOMStringMap):
  | {
      entityId: string
      entityKind: NodeViewTrackingArgs['entityKind']
      optimizationId: string
      variantId: string
      variantIndex: number
      entityKindId?: string
      entryIds?: string
      parentExperienceId?: string
    }
  | undefined {
  const {
    ctflNodeId,
    ctflEntityId,
    ctflEntityKind,
    ctflOptimizationId,
    ctflVariant,
    ctflVariantIndex,
    ctflEntityKindId,
    ctflEntryIds,
    ctflParentExperienceId,
  } = dataset

  const variantIndex = parseVariantIndex(ctflVariantIndex)
  const required = {
    nodeId: ctflNodeId ?? '',
    entityId: ctflEntityId ?? '',
    entityKind: ctflEntityKind ?? '',
    optimizationId: ctflOptimizationId ?? '',
    variantId: ctflVariant ?? '',
  }

  if (Object.values(required).some((value) => !value) || variantIndex === undefined) {
    return undefined
  }

  if (!isKnownEntityKind(required.entityKind)) {
    return undefined
  }

  return {
    entityId: required.entityId,
    entityKind: required.entityKind,
    optimizationId: required.optimizationId,
    variantId: required.variantId,
    variantIndex,
    entityKindId: ctflEntityKindId,
    entryIds: ctflEntryIds,
    parentExperienceId: ctflParentExperienceId,
  }
}

function resolveNodeViewArgs(
  element: Element,
  info: ElementViewCallbackInfo,
): NodeViewTrackingArgs | undefined {
  if (!isHtmlOrSvgElement(element)) {
    return undefined
  }

  const { dataset } = element
  if (parseBooleanOverride(dataset.ctflTrackNodeViews) === false) {
    return undefined
  }

  const resolved = resolveNodeViewDataset(dataset)
  if (resolved === undefined) {
    return undefined
  }

  return {
    entityId: resolved.entityId,
    entityKind: resolved.entityKind,
    optimizationId: resolved.optimizationId,
    variantId: resolved.variantId,
    variantIndex: resolved.variantIndex,
    viewId: info.viewId,
    viewDurationMs: Math.max(0, Math.round(info.totalVisibleMs)),
    entityKindId: resolved.entityKindId,
    entryIds: parseEntryIds(resolved.entryIds),
    parentExperienceId: resolved.parentExperienceId,
  }
}

/**
 * Create an `ElementViewObserver`-backed detector that fires `trackNodeView`
 * once an element with node-view dataset attributes has dwelled in the
 * viewport.
 *
 * @param core - Object exposing {@link NodeViewTrackingCore.trackNodeView}.
 * @param options - Optional `ElementViewObserver` configuration (dwell time,
 *   visible ratio, etc.).
 * @returns A {@link NodeViewDetector} that manages element observation.
 *
 * @internal
 */
export function createNodeViewDetector(
  core: NodeViewTrackingCore,
  options?: ElementViewObserverOptions,
): NodeViewDetector {
  const callback = async (element: Element, info: ElementViewCallbackInfo): Promise<void> => {
    const args = resolveNodeViewArgs(element, info)
    if (args !== undefined) {
      await core.trackNodeView(args)
    }
  }

  const observer = new ElementViewObserver(callback, options)

  return {
    observe: (element): void => {
      observer.observe(element)
    },
    unobserve: (element): void => {
      observer.unobserve(element)
    },
    disconnect: (): void => {
      observer.disconnect()
    },
  }
}

import type { NodeViewTrackingArgs } from '@contentful/optimization-core'
import type { ExoNodeLayer } from '@contentful/optimization-core/api-schemas'
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
  if (!value?.trim()) return undefined
  const ids = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.length > 0 ? ids : undefined
}

function parseLayerValue(raw: unknown): ExoNodeLayer | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const { entityKind, entityId, variant, optimizationId } = raw as {
    entityKind?: unknown
    entityId?: unknown
    variant?: unknown
    optimizationId?: unknown
  }
  if (typeof entityKind !== 'string' || typeof entityId !== 'string') return undefined
  if (!isKnownEntityKind(entityKind)) return undefined
  return {
    entityKind,
    entityId,
    variant: typeof variant === 'string' ? variant : undefined,
    optimizationId: typeof optimizationId === 'string' ? optimizationId : undefined,
  }
}

function parseLayers(value: string | undefined): ExoNodeLayer[] | undefined {
  if (!value?.trim()) return undefined
  const parsed: unknown = (() => {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return undefined
    }
  })()
  if (!Array.isArray(parsed)) return undefined
  const layers = parsed.map(parseLayerValue).filter((l): l is ExoNodeLayer => l !== undefined)
  return layers.length > 0 ? layers : undefined
}

function resolveNodeViewArgs(
  element: Element,
  info: ElementViewCallbackInfo,
): NodeViewTrackingArgs | undefined {
  if (!isHtmlOrSvgElement(element)) return undefined

  const {
    dataset: {
      ctflNodeId,
      ctflEntityId,
      ctflEntityKind,
      ctflOptimizationId,
      ctflTrackNodeViews,
      ctflVariant,
      ctflEntityKindId,
      ctflEntryIds,
      ctflLayers,
      ctflParentExperienceId,
    },
  } = element

  const override = parseBooleanOverride(ctflTrackNodeViews)
  if (override === false) return undefined

  if (!ctflNodeId || !ctflEntityId || !ctflEntityKind || !ctflOptimizationId || !ctflVariant)
    return undefined

  if (!isKnownEntityKind(ctflEntityKind)) return undefined

  return {
    entityId: ctflEntityId,
    entityKind: ctflEntityKind,
    optimizationId: ctflOptimizationId,
    variant: ctflVariant,
    viewId: info.viewId,
    viewDurationMs: Math.max(0, Math.round(info.totalVisibleMs)),
    entityKindId: ctflEntityKindId,
    entryIds: parseEntryIds(ctflEntryIds),
    layers: parseLayers(ctflLayers),
    parentExperienceId: ctflParentExperienceId,
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

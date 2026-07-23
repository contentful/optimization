'use client'

import type ContentfulOptimization from '@contentful/optimization-web'
import {
  NodeInteractionRuntime,
  resolveNodeViewPayload,
  type NodeInteraction,
  type ResolvedNodeMetadata,
} from '@contentful/optimization-web'
import type { SourceMap } from '@contentful/optimization-web/api-schemas'
import { useCallback, useMemo, useRef } from 'react'

/**
 * Adapter published on the `./experiences-adapter` subpath so that
 * `@contentful/experiences-react` can hook up per-node instrumentation without
 * importing SDK internals directly.
 *
 * @public
 */
export interface ExperiencesOptimizationAdapter {
  useNodeBinding: (
    nodeId: string,
    sourceMap: SourceMap | undefined,
  ) => {
    ref: (element: HTMLElement | null) => void
    resolved: ResolvedNodeMetadata | null
  }
  attachInteractionRuntime: (opts: {
    views: boolean
    clicks: boolean
    hovers: boolean
  }) => () => void
}

/**
 * Attributes stamped by the ref-callback. Kept as an ordered pair-list so
 * the write loop is a single pass and the vocabulary matches
 * `resolveNodeDataset` on the runtime side (see
 * `packages/web/web-sdk/src/entry-tracking/resolveNodeViewArgs.ts`).
 */
const NODE_ATTRIBUTES = [
  'data-ctfl-node-id',
  'data-ctfl-entity-id',
  'data-ctfl-entity-kind',
  'data-ctfl-optimization-id',
  'data-ctfl-variant',
  'data-ctfl-variant-index',
  'data-ctfl-parent-experience-id',
] as const

function stampNodeAttributes(
  element: HTMLElement,
  nodeId: string,
  resolved: ResolvedNodeMetadata,
): void {
  element.setAttribute('data-ctfl-node-id', nodeId)
  element.setAttribute('data-ctfl-entity-id', resolved.entityId)
  element.setAttribute('data-ctfl-entity-kind', resolved.entityKind)
  element.setAttribute('data-ctfl-optimization-id', resolved.optimizationId)
  element.setAttribute('data-ctfl-variant', resolved.variantId)
  element.setAttribute('data-ctfl-variant-index', String(resolved.variantIndex))
  if (resolved.parentExperienceId !== undefined) {
    element.setAttribute('data-ctfl-parent-experience-id', resolved.parentExperienceId)
  } else {
    element.removeAttribute('data-ctfl-parent-experience-id')
  }
}

function clearNodeAttributes(element: HTMLElement): void {
  NODE_ATTRIBUTES.forEach((attribute) => {
    element.removeAttribute(attribute)
  })
}

const runtimeByOptimization = new WeakMap<ContentfulOptimization, NodeInteractionRuntime>()

function ensureRuntime(optimization: ContentfulOptimization): NodeInteractionRuntime {
  const cached = runtimeByOptimization.get(optimization)
  if (cached !== undefined) return cached

  const runtime = new NodeInteractionRuntime(optimization)
  runtimeByOptimization.set(optimization, runtime)
  return runtime
}

const NODE_INTERACTIONS: readonly NodeInteraction[] = ['views', 'clicks', 'hovers']

/**
 * Build the adapter surface consumed by `@contentful/experiences-react`.
 *
 * @remarks
 * The adapter is a pure function of the optimization instance — it holds no
 * closure state beyond a per-instance {@link NodeInteractionRuntime} cached on
 * a module-level `WeakMap`. Calling `getExperiencesAdapter` twice with the
 * same instance returns two adapter objects that share the same runtime, so
 * multiple mounted renderers coordinate through a single observer set.
 *
 * @public
 */
export function getExperiencesAdapter(
  optimization: ContentfulOptimization,
): ExperiencesOptimizationAdapter {
  const useNodeBinding: ExperiencesOptimizationAdapter['useNodeBinding'] = (nodeId, sourceMap) => {
    const resolved = useMemo(
      () => (sourceMap === undefined ? null : resolveNodeViewPayload(nodeId, sourceMap)),
      [nodeId, sourceMap],
    )

    const lastElement = useRef<HTMLElement | null>(null)

    const ref = useCallback(
      (element: HTMLElement | null): void => {
        const { current: previous } = lastElement
        if (previous && previous !== element) {
          clearNodeAttributes(previous)
        }
        lastElement.current = element
        if (element === null) return
        if (resolved === null) {
          clearNodeAttributes(element)
          return
        }
        stampNodeAttributes(element, nodeId, resolved)
      },
      [nodeId, resolved],
    )

    return { ref, resolved }
  }

  const attachInteractionRuntime: ExperiencesOptimizationAdapter['attachInteractionRuntime'] = (
    opts,
  ) => {
    const runtime = ensureRuntime(optimization)
    const enabled: NodeInteraction[] = []
    NODE_INTERACTIONS.forEach((interaction) => {
      if (opts[interaction]) {
        runtime.tracking.enable(interaction)
        enabled.push(interaction)
      }
    })

    return () => {
      enabled.forEach((interaction) => {
        runtime.tracking.disable(interaction)
      })
    }
  }

  return { useNodeBinding, attachInteractionRuntime }
}

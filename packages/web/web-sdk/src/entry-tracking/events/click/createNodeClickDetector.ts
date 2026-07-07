import type { CoreStateful } from '@contentful/optimization-core'
import { createScopedLogger } from '@contentful/optimization-core/logger'
import { NODE_SELECTOR } from '../../../constants'
import type { NodeInteractionDetector } from '../../NodeInteractionDetector'
import { resolveNodeDataset } from '../../resolveNodeViewArgs'

const logger = createScopedLogger('Web:NodeClickTracking')

/**
 * Minimal core shape required by {@link createNodeClickDetector}.
 *
 * @public
 */
export type NodeClickTrackingCore = Pick<CoreStateful, 'trackClick'>

const CLICKABLE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[onclick]',
  '[data-ctfl-clickable="true"]',
].join(',')

function hasOnclickPropertyHandler(element: Element): boolean {
  return element instanceof HTMLElement && typeof element.onclick === 'function'
}

function toEventTargetElement(event: Event): Element | undefined {
  if (event.target instanceof Element) return event.target

  const { target: targetNode } = event

  return targetNode instanceof Node ? (targetNode.parentElement ?? undefined) : undefined
}

/**
 * Create a document-delegated click detector keyed on `data-ctfl-node-id`
 * elements. On click, walks from the event target up to the nearest observed
 * node element, verifies a clickable path exists in between, then fires
 * `core.trackClick` with the resolved dataset mapped to `componentId` /
 * `experienceId` / `variantIndex`.
 *
 * @internal
 */
function hasClickablePathBetween(from: Element, until: Element): boolean {
  if (from.closest(CLICKABLE_SELECTOR) !== null) return true

  let current: Element | null = from
  const { parentElement: stop } = until
  while (current && current !== stop) {
    if (hasOnclickPropertyHandler(current)) return true
    const { parentElement }: { parentElement: Element | null } = current
    current = parentElement
  }
  return false
}

export function createNodeClickDetector(core: NodeClickTrackingCore): NodeInteractionDetector {
  const observed = new Set<Element>()
  let listening = false

  const onDocumentClick = (event: MouseEvent): void => {
    const eventTarget = toEventTargetElement(event)
    if (!eventTarget) return

    const nodeElement = eventTarget.closest(NODE_SELECTOR)
    if (!nodeElement || !observed.has(nodeElement)) return

    if (!hasClickablePathBetween(eventTarget, nodeElement)) return

    const resolved = resolveNodeDataset(nodeElement)
    if (!resolved) {
      logger.warn('No node data found in node click callback; expected data-ctfl-* attributes')
      return
    }

    void core.trackClick({
      componentId: resolved.entityId,
      experienceId: resolved.parentExperienceId ?? resolved.optimizationId,
      variantIndex: resolved.variantIndex,
    })
  }

  const ensureListener = (): void => {
    if (listening || typeof document === 'undefined') return
    document.addEventListener('click', onDocumentClick, true)
    listening = true
  }

  const maybeRemoveListener = (): void => {
    if (!listening || observed.size > 0) return
    if (typeof document === 'undefined') return
    document.removeEventListener('click', onDocumentClick, true)
    listening = false
  }

  return {
    observe: (element): void => {
      observed.add(element)
      ensureListener()
    },
    unobserve: (element): void => {
      if (!observed.delete(element)) return
      maybeRemoveListener()
    },
    disconnect: (): void => {
      observed.clear()
      if (listening && typeof document !== 'undefined') {
        document.removeEventListener('click', onDocumentClick, true)
      }
      listening = false
    },
  }
}

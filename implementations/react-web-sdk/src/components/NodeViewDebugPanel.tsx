import { useOptimizationContext, type OptimizationSdk } from '@contentful/optimization-react-web'
import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { isRecord } from '../utils/typeGuards'

interface NodeViewEventSummary {
  entityId: string
  entityKind: string
  optimizationId: string
  variant: string
  viewDurationMs: number
  viewId: string
}

interface BlockedNodeViewSummary {
  method: string
  reason: string
}

interface NodeViewDatasetSnapshot {
  entityId: string | undefined
  entityKind: string | undefined
  nodeId: string | undefined
  optimizationId: string | undefined
  variant: string | undefined
}

interface NodeViewRuntimeSnapshot {
  autoTrackNodeInteractionViews: boolean | undefined
  matchingNodeElementsCount: number
  runtimeStarted: boolean | undefined
}

const NODE_VIEW_SELECTOR = '[data-ctfl-node-id]'

function reflectGet(target: object, key: string): unknown {
  return Reflect.get(target, key) as unknown
}

function isHtmlOrSvgElement(element: Element): element is HTMLElement | SVGElement {
  if (typeof HTMLElement === 'undefined' || typeof SVGElement === 'undefined') {
    return false
  }

  return element instanceof HTMLElement || element instanceof SVGElement
}

function readNodeViewTargetSnapshot(): NodeViewDatasetSnapshot | undefined {
  const element = document.querySelector('[data-testid="node-view-target"]')
  if (!element || !isHtmlOrSvgElement(element)) {
    return undefined
  }

  const {
    dataset: { ctflEntityId, ctflEntityKind, ctflNodeId, ctflOptimizationId, ctflVariant },
  } = element

  return {
    entityId: ctflEntityId,
    entityKind: ctflEntityKind,
    nodeId: ctflNodeId,
    optimizationId: ctflOptimizationId,
    variant: ctflVariant,
  }
}

function readRuntimeSnapshot(sdk: OptimizationSdk | undefined): NodeViewRuntimeSnapshot {
  const matchingNodeElementsCount =
    typeof document === 'undefined' ? 0 : document.querySelectorAll(NODE_VIEW_SELECTOR).length

  if (!sdk) {
    return {
      autoTrackNodeInteractionViews: undefined,
      matchingNodeElementsCount,
      runtimeStarted: undefined,
    }
  }

  const config = reflectGet(sdk, 'autoTrackNodeInteraction')
  const views = config && typeof config === 'object' ? reflectGet(config, 'views') : undefined
  const autoTrackNodeInteractionViews = typeof views === 'boolean' ? views : undefined

  const runtime = reflectGet(sdk, 'nodeViewRuntime')
  const runtimeStarted =
    runtime && typeof runtime === 'object' ? reflectGet(runtime, 'detector') != null : undefined

  return { autoTrackNodeInteractionViews, matchingNodeElementsCount, runtimeStarted }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function toNodeViewEvent(event: unknown): NodeViewEventSummary | undefined {
  if (!isRecord(event) || event.type !== 'exo_view') return undefined

  const entityId = asString(event.entityId)
  const entityKind = asString(event.entityKind)
  const optimizationId = asString(event.optimizationId)
  const variant = asString(event.variant)
  const viewId = asString(event.viewId)
  const viewDurationMs = typeof event.viewDurationMs === 'number' ? event.viewDurationMs : undefined

  if (
    !entityId ||
    !entityKind ||
    !optimizationId ||
    !variant ||
    !viewId ||
    viewDurationMs === undefined
  ) {
    return undefined
  }

  return { entityId, entityKind, optimizationId, variant, viewId, viewDurationMs }
}

function toBlockedNodeViewSummary(event: unknown): BlockedNodeViewSummary | undefined {
  if (!isRecord(event)) return undefined
  const method = typeof event.method === 'string' ? event.method : undefined
  const reason = typeof event.reason === 'string' ? event.reason : undefined
  if (method !== 'trackNodeView' || reason === undefined) return undefined
  return { method, reason }
}

interface NodeViewDebugState {
  consent: boolean | undefined
  latestBlockedNodeView: BlockedNodeViewSummary | undefined
  latestNodeViewEvent: NodeViewEventSummary | undefined
  nodeViewEventsSeen: number
  profileId: string | undefined
  runtimeSnapshot: NodeViewRuntimeSnapshot
  targetSnapshot: NodeViewDatasetSnapshot | undefined
}

const INITIAL_RUNTIME_SNAPSHOT: NodeViewRuntimeSnapshot = {
  autoTrackNodeInteractionViews: undefined,
  matchingNodeElementsCount: 0,
  runtimeStarted: undefined,
}

function useNodeViewDebugState(
  sdk: OptimizationSdk | undefined,
  isReady: boolean,
): NodeViewDebugState {
  const [consent, setConsent] = useState<boolean | undefined>(undefined)
  const [profileId, setProfileId] = useState<string | undefined>(undefined)
  const [nodeViewEventsSeen, setNodeViewEventsSeen] = useState(0)
  const [latestNodeViewEvent, setLatestNodeViewEvent] = useState<NodeViewEventSummary | undefined>(
    undefined,
  )
  const [latestBlockedNodeView, setLatestBlockedNodeView] = useState<
    BlockedNodeViewSummary | undefined
  >(undefined)
  const [targetSnapshot, setTargetSnapshot] = useState<NodeViewDatasetSnapshot | undefined>(
    undefined,
  )
  const [runtimeSnapshot, setRuntimeSnapshot] =
    useState<NodeViewRuntimeSnapshot>(INITIAL_RUNTIME_SNAPSHOT)

  useEffect(() => {
    if (!sdk || !isReady) {
      setConsent(undefined)
      setProfileId(undefined)
      setNodeViewEventsSeen(0)
      setLatestNodeViewEvent(undefined)
      setLatestBlockedNodeView(undefined)
      setTargetSnapshot(undefined)
      setRuntimeSnapshot(INITIAL_RUNTIME_SNAPSHOT)
      return
    }

    setTargetSnapshot(readNodeViewTargetSnapshot())
    setRuntimeSnapshot(readRuntimeSnapshot(sdk))

    const consentSub = sdk.states.consent.subscribe((value: boolean | undefined) => {
      setConsent(value)
      setRuntimeSnapshot(readRuntimeSnapshot(sdk))
    })

    const profileSub = sdk.states.profile.subscribe((value: unknown) => {
      if (!isRecord(value) || typeof value.id !== 'string') {
        setProfileId(undefined)
        return
      }
      setProfileId(value.id)
    })

    const eventSub = sdk.states.eventStream.subscribe((event: unknown) => {
      const nodeViewEvent = toNodeViewEvent(event)
      if (!nodeViewEvent) return
      setNodeViewEventsSeen((previous) => previous + 1)
      setLatestNodeViewEvent(nodeViewEvent)
      setTargetSnapshot(readNodeViewTargetSnapshot())
      setRuntimeSnapshot(readRuntimeSnapshot(sdk))
    })

    const blockedSub = sdk.states.blockedEventStream.subscribe((event: unknown) => {
      const blockedNodeView = toBlockedNodeViewSummary(event)
      if (!blockedNodeView) return
      setLatestBlockedNodeView(blockedNodeView)
    })

    return () => {
      consentSub.unsubscribe()
      profileSub.unsubscribe()
      eventSub.unsubscribe()
      blockedSub.unsubscribe()
    }
  }, [isReady, sdk])

  return {
    consent,
    latestBlockedNodeView,
    latestNodeViewEvent,
    nodeViewEventsSeen,
    profileId,
    runtimeSnapshot,
    targetSnapshot,
  }
}

export function NodeViewDebugPanel(): JSX.Element {
  const { isReady, sdk } = useOptimizationContext()
  const {
    consent,
    latestBlockedNodeView,
    latestNodeViewEvent,
    nodeViewEventsSeen,
    profileId,
    runtimeSnapshot,
    targetSnapshot,
  } = useNodeViewDebugState(sdk, isReady)

  return (
    <section
      style={{ border: '1px solid #ccc', borderRadius: 4, display: 'grid', gap: 8, padding: 12 }}
    >
      <h3>Node view debug panel</h3>
      <p>Consent: {`${consent}`}</p>
      <p>Profile ID: {profileId}</p>
      <p>Node view events seen: {nodeViewEventsSeen}</p>
      <p>Node target present: {`${targetSnapshot !== undefined}`}</p>
      <p>Matching node elements: {runtimeSnapshot.matchingNodeElementsCount}</p>
      <p>autoTrackNodeInteraction.views: {`${runtimeSnapshot.autoTrackNodeInteractionViews}`}</p>
      <p>nodeViewRuntime started: {`${runtimeSnapshot.runtimeStarted}`}</p>
      <p>nodeId: {targetSnapshot?.nodeId}</p>
      <p>entityId: {targetSnapshot?.entityId}</p>
      <p>entityKind: {targetSnapshot?.entityKind}</p>
      <p>optimizationId: {targetSnapshot?.optimizationId}</p>
      <p>variant: {targetSnapshot?.variant}</p>
      <p>
        Last blocked:{' '}
        {latestBlockedNodeView && `${latestBlockedNodeView.method}:${latestBlockedNodeView.reason}`}
      </p>
      <p>Last exo_view viewId: {latestNodeViewEvent?.viewId}</p>
      <p>Last exo_view duration: {latestNodeViewEvent?.viewDurationMs}ms</p>
      <p>Insights events are queued by the SDK; network emission can lag behind event detection.</p>
    </section>
  )
}

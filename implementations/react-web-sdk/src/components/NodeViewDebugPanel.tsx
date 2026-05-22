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
const ZERO_DURATION_MS = 0

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

function readAutoTrackNodeInteractionViews(sdk: OptimizationSdk): boolean | undefined {
  const config = reflectGet(sdk, 'autoTrackNodeInteraction')
  if (!config || typeof config !== 'object') return undefined
  const views = reflectGet(config, 'views')
  return typeof views === 'boolean' ? views : undefined
}

function readRuntimeStarted(sdk: OptimizationSdk): boolean | undefined {
  const runtime = reflectGet(sdk, 'nodeViewRuntime')
  if (!runtime || typeof runtime !== 'object') return undefined
  const detector = reflectGet(runtime, 'detector')
  return detector !== null && detector !== undefined
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

  return {
    autoTrackNodeInteractionViews: readAutoTrackNodeInteractionViews(sdk),
    matchingNodeElementsCount,
    runtimeStarted: readRuntimeStarted(sdk),
  }
}

function isKnownEntityKind(value: string): boolean {
  return (
    value === 'Experience' ||
    value === 'Fragment' ||
    value === 'InlineFragment' ||
    value === 'InlineComponent'
  )
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function orNone(value: string | undefined): string {
  return value ?? 'none'
}

function formatTarget(snapshot: NodeViewDatasetSnapshot | undefined): Record<string, string> {
  return {
    presence: snapshot ? 'yes' : 'no',
    nodeId: orNone(snapshot?.nodeId),
    entityId: orNone(snapshot?.entityId),
    entityKind: orNone(snapshot?.entityKind),
    optimizationId: orNone(snapshot?.optimizationId),
    variant: orNone(snapshot?.variant),
  }
}

function formatNodeViewEvent(event: NodeViewEventSummary | undefined): {
  viewId: string
  viewDuration: number
} {
  return {
    viewId: orNone(event?.viewId),
    viewDuration: event?.viewDurationMs ?? 0,
  }
}

function extractNodeViewStrings(
  event: Record<string, unknown>,
):
  | Pick<NodeViewEventSummary, 'entityId' | 'entityKind' | 'optimizationId' | 'variant' | 'viewId'>
  | undefined {
  const entityId = asString(event.entityId)
  const entityKind = asString(event.entityKind)
  const optimizationId = asString(event.optimizationId)
  const variant = asString(event.variant)
  const viewId = asString(event.viewId)
  if (!entityId || !entityKind || !optimizationId || !variant || !viewId) return undefined
  return { entityId, entityKind, optimizationId, variant, viewId }
}

function extractNodeViewFields(event: Record<string, unknown>): NodeViewEventSummary | undefined {
  const strings = extractNodeViewStrings(event)
  if (!strings) return undefined
  const viewDurationMs = typeof event.viewDurationMs === 'number' ? event.viewDurationMs : undefined
  if (viewDurationMs === undefined) return undefined
  return { ...strings, viewDurationMs }
}

function toNodeViewEvent(event: unknown): NodeViewEventSummary | undefined {
  if (!isRecord(event) || event.type !== 'exo_view') return undefined
  return extractNodeViewFields(event)
}

function toBlockedNodeViewSummary(event: unknown): BlockedNodeViewSummary | undefined {
  if (!isRecord(event)) return undefined
  const method = typeof event.method === 'string' ? event.method : undefined
  const reason = typeof event.reason === 'string' ? event.reason : undefined
  if (method !== 'trackNodeView' || reason === undefined) return undefined
  return { method, reason }
}

async function triggerManualNodeView(
  sdk: OptimizationSdk | undefined,
  snapshot: NodeViewDatasetSnapshot | undefined,
): Promise<string> {
  if (
    !snapshot?.entityId ||
    !snapshot.entityKind ||
    !snapshot.optimizationId ||
    !snapshot.variant
  ) {
    return 'Manual trigger skipped: node dataset is incomplete.'
  }

  if (!isKnownEntityKind(snapshot.entityKind)) {
    return `Manual trigger skipped: unknown entityKind "${snapshot.entityKind}".`
  }

  if (!sdk) return 'Manual trigger skipped: SDK instance is unavailable.'

  const trackNodeView = reflectGet(sdk, 'trackNodeView')
  if (typeof trackNodeView !== 'function') {
    return 'Manual trigger skipped: sdk.trackNodeView() is unavailable.'
  }

  await Promise.resolve(
    trackNodeView.call(sdk, {
      entityId: snapshot.entityId,
      entityKind: snapshot.entityKind,
      optimizationId: snapshot.optimizationId,
      variant: snapshot.variant,
      viewDurationMs: ZERO_DURATION_MS,
      viewId: crypto.randomUUID(),
    }) as unknown,
  )

  return 'Manual trackNodeView() call sent.'
}

function restartNodeViewRuntime(sdk: OptimizationSdk | undefined): string {
  if (!sdk) return 'Runtime restart skipped: SDK instance is unavailable.'

  const runtime = reflectGet(sdk, 'nodeViewRuntime')
  if (!runtime || typeof runtime !== 'object') {
    return 'Runtime restart skipped: nodeViewRuntime is unavailable.'
  }

  const stop = reflectGet(runtime, 'stop')
  const start = reflectGet(runtime, 'start')
  if (typeof stop !== 'function' || typeof start !== 'function') {
    return 'Runtime restart skipped: nodeViewRuntime start/stop are unavailable.'
  }

  stop.call(runtime)
  start.call(runtime)

  return 'nodeViewRuntime restarted.'
}

interface NodeViewStatusDisplayProps {
  consent: boolean | undefined
  latestBlockedNodeView: BlockedNodeViewSummary | undefined
  latestNodeViewEvent: NodeViewEventSummary | undefined
  manualTriggerStatus: string
  nodeViewEventsSeen: number
  profileId: string | undefined
  runtimeControlStatus: string
  runtimeSnapshot: NodeViewRuntimeSnapshot
  targetSnapshot: NodeViewDatasetSnapshot | undefined
}

function NodeViewStatusDisplay({
  consent,
  latestBlockedNodeView,
  latestNodeViewEvent,
  manualTriggerStatus,
  nodeViewEventsSeen,
  profileId,
  runtimeControlStatus,
  runtimeSnapshot,
  targetSnapshot,
}: NodeViewStatusDisplayProps): JSX.Element {
  const blockedSummary = latestBlockedNodeView
    ? `${latestBlockedNodeView.method}:${latestBlockedNodeView.reason}`
    : undefined
  const target = formatTarget(targetSnapshot)
  const event = formatNodeViewEvent(latestNodeViewEvent)

  return (
    <>
      <p data-testid="node-view-debug-consent">Consent: {String(consent)}</p>
      <p data-testid="node-view-debug-profile">Profile ID: {orNone(profileId)}</p>
      <p data-testid="node-view-debug-events-seen">Node view events seen: {nodeViewEventsSeen}</p>
      <p data-testid="node-view-debug-target-presence">Node target present: {target.presence}</p>
      <p data-testid="node-view-debug-selector-count">
        Matching node elements: {runtimeSnapshot.matchingNodeElementsCount}
      </p>
      <p data-testid="node-view-debug-auto-track">
        autoTrackNodeInteraction.views: {String(runtimeSnapshot.autoTrackNodeInteractionViews)}
      </p>
      <p data-testid="node-view-debug-runtime-started">
        nodeViewRuntime started: {String(runtimeSnapshot.runtimeStarted)}
      </p>
      <p data-testid="node-view-debug-target-node-id">nodeId: {target.nodeId}</p>
      <p data-testid="node-view-debug-target-entity-id">entityId: {target.entityId}</p>
      <p data-testid="node-view-debug-target-entity-kind">entityKind: {target.entityKind}</p>
      <p data-testid="node-view-debug-target-optimization-id">
        optimizationId: {target.optimizationId}
      </p>
      <p data-testid="node-view-debug-target-variant">variant: {target.variant}</p>
      <p data-testid="node-view-debug-latest-blocked">Last blocked: {orNone(blockedSummary)}</p>
      <p data-testid="node-view-debug-latest-view-id">Last exo_view viewId: {event.viewId}</p>
      <p data-testid="node-view-debug-latest-duration">
        Last exo_view duration: {event.viewDuration}ms
      </p>
      <p>Insights events are queued by the SDK; network emission can lag behind event detection.</p>
      <p data-testid="node-view-debug-manual-status">Manual trigger: {manualTriggerStatus}</p>
      <p data-testid="node-view-debug-runtime-status">Runtime control: {runtimeControlStatus}</p>
    </>
  )
}

interface NodeViewControlsProps {
  sdk: OptimizationSdk | undefined
  setManualTriggerStatus: (value: string) => void
  setRuntimeControlStatus: (value: string) => void
  setRuntimeSnapshot: (value: NodeViewRuntimeSnapshot) => void
  setTargetSnapshot: (value: NodeViewDatasetSnapshot | undefined) => void
}

function NodeViewControls({
  sdk,
  setManualTriggerStatus,
  setRuntimeControlStatus,
  setRuntimeSnapshot,
  setTargetSnapshot,
}: NodeViewControlsProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button
        data-testid="node-view-debug-refresh"
        onClick={() => {
          setTargetSnapshot(readNodeViewTargetSnapshot())
          setRuntimeSnapshot(readRuntimeSnapshot(sdk))
        }}
        type="button"
      >
        Refresh node snapshot
      </button>
      <button
        data-testid="node-view-debug-manual-track"
        onClick={() => {
          void triggerManualNodeView(sdk, readNodeViewTargetSnapshot())
            .then((message) => {
              setManualTriggerStatus(message)
            })
            .catch((error: unknown) => {
              const reason = error instanceof Error ? error.message : String(error)
              setManualTriggerStatus(`Manual trigger failed: ${reason}`)
            })
        }}
        type="button"
      >
        Trigger manual exo_view
      </button>
      <button
        data-testid="node-view-debug-restart-runtime"
        onClick={() => {
          setRuntimeControlStatus(restartNodeViewRuntime(sdk))
          setRuntimeSnapshot(readRuntimeSnapshot(sdk))
        }}
        type="button"
      >
        Restart node runtime
      </button>
    </div>
  )
}

const INITIAL_RUNTIME_SNAPSHOT: NodeViewRuntimeSnapshot = {
  autoTrackNodeInteractionViews: undefined,
  matchingNodeElementsCount: 0,
  runtimeStarted: undefined,
}

interface NodeViewDebugState {
  consent: boolean | undefined
  latestBlockedNodeView: BlockedNodeViewSummary | undefined
  latestNodeViewEvent: NodeViewEventSummary | undefined
  manualTriggerStatus: string
  nodeViewEventsSeen: number
  profileId: string | undefined
  runtimeControlStatus: string
  runtimeSnapshot: NodeViewRuntimeSnapshot
  setManualTriggerStatus: (value: string) => void
  setRuntimeControlStatus: (value: string) => void
  setRuntimeSnapshot: (value: NodeViewRuntimeSnapshot) => void
  setTargetSnapshot: (value: NodeViewDatasetSnapshot | undefined) => void
  targetSnapshot: NodeViewDatasetSnapshot | undefined
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
  const [manualTriggerStatus, setManualTriggerStatus] = useState('No manual trigger yet.')
  const [runtimeControlStatus, setRuntimeControlStatus] = useState('No runtime action yet.')

  useEffect(() => {
    if (!sdk || !isReady) {
      setConsent(undefined)
      setProfileId(undefined)
      setNodeViewEventsSeen(0)
      setLatestNodeViewEvent(undefined)
      setLatestBlockedNodeView(undefined)
      setTargetSnapshot(undefined)
      setRuntimeSnapshot(INITIAL_RUNTIME_SNAPSHOT)
      setManualTriggerStatus('No manual trigger yet.')
      setRuntimeControlStatus('No runtime action yet.')
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
    manualTriggerStatus,
    nodeViewEventsSeen,
    profileId,
    runtimeControlStatus,
    runtimeSnapshot,
    setManualTriggerStatus,
    setRuntimeControlStatus,
    setRuntimeSnapshot,
    setTargetSnapshot,
    targetSnapshot,
  }
}

export function NodeViewDebugPanel(): JSX.Element {
  const { isReady, sdk } = useOptimizationContext()
  const {
    consent,
    latestBlockedNodeView,
    latestNodeViewEvent,
    manualTriggerStatus,
    nodeViewEventsSeen,
    profileId,
    runtimeControlStatus,
    runtimeSnapshot,
    setManualTriggerStatus,
    setRuntimeControlStatus,
    setRuntimeSnapshot,
    setTargetSnapshot,
    targetSnapshot,
  } = useNodeViewDebugState(sdk, isReady)

  return (
    <section
      data-testid="node-view-debug-panel"
      style={{ border: '1px solid #ccc', borderRadius: 4, display: 'grid', gap: 8, padding: 12 }}
    >
      <h3>Node view debug panel</h3>
      <NodeViewStatusDisplay
        consent={consent}
        latestBlockedNodeView={latestBlockedNodeView}
        latestNodeViewEvent={latestNodeViewEvent}
        manualTriggerStatus={manualTriggerStatus}
        nodeViewEventsSeen={nodeViewEventsSeen}
        profileId={profileId}
        runtimeControlStatus={runtimeControlStatus}
        runtimeSnapshot={runtimeSnapshot}
        targetSnapshot={targetSnapshot}
      />
      <NodeViewControls
        sdk={sdk}
        setManualTriggerStatus={setManualTriggerStatus}
        setRuntimeControlStatus={setRuntimeControlStatus}
        setRuntimeSnapshot={setRuntimeSnapshot}
        setTargetSnapshot={setTargetSnapshot}
      />
    </section>
  )
}

/**
 * Detector contract implemented by node-keyed interaction strategies
 * (view / click / hover). The `NodeInteractionRuntime` coordinates element
 * discovery and observation state; detectors expose an `observe`/`unobserve`
 * surface plus a `disconnect` teardown hook.
 *
 * @internal
 */
export interface NodeInteractionDetector {
  observe: (element: Element) => void
  unobserve: (element: Element) => void
  disconnect: () => void
}

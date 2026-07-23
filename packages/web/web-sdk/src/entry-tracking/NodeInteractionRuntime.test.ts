import type { NodeInteractionDetector } from './NodeInteractionDetector'
import { NodeInteractionRuntime } from './NodeInteractionRuntime'
import * as clickDetectorModule from './events/click/createNodeClickDetector'
import * as hoverDetectorModule from './events/hover/createNodeHoverDetector'
import * as viewDetectorModule from './events/view/createNodeViewDetector'

interface DetectorMocks extends NodeInteractionDetector {
  observe: ReturnType<typeof rs.fn>
  unobserve: ReturnType<typeof rs.fn>
  disconnect: ReturnType<typeof rs.fn>
}

const createDetectorMocks = (): DetectorMocks => ({
  observe: rs.fn(),
  unobserve: rs.fn(),
  disconnect: rs.fn(),
})

function createRuntime(hasConsent: (name: string) => boolean = () => true): {
  runtime: NodeInteractionRuntime
  viewDetector: DetectorMocks
  clickDetector: DetectorMocks
  hoverDetector: DetectorMocks
} {
  const core = {
    trackNodeView: rs.fn().mockResolvedValue(undefined),
    trackClick: rs.fn().mockResolvedValue(undefined),
    trackHover: rs.fn().mockResolvedValue(undefined),
    hasConsent: rs.fn(hasConsent),
  }
  const viewDetector = createDetectorMocks()
  const clickDetector = createDetectorMocks()
  const hoverDetector = createDetectorMocks()

  rs.spyOn(viewDetectorModule, 'createNodeViewDetector').mockReturnValue(viewDetector)
  rs.spyOn(clickDetectorModule, 'createNodeClickDetector').mockReturnValue(clickDetector)
  rs.spyOn(hoverDetectorModule, 'createNodeHoverDetector').mockReturnValue(hoverDetector)

  return {
    runtime: new NodeInteractionRuntime(core),
    viewDetector,
    clickDetector,
    hoverDetector,
  }
}

function makeNodeElement(id = 'node-1'): HTMLElement {
  const el = document.createElement('div')
  el.dataset.ctflNodeId = id
  return el
}

describe('NodeInteractionRuntime', () => {
  afterEach(() => {
    rs.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('seeds existing node elements onto each newly enabled detector', () => {
    const seeded = makeNodeElement('seeded')
    document.body.append(seeded)
    const { runtime, viewDetector, clickDetector, hoverDetector } = createRuntime()

    runtime.tracking.enable('views')
    expect(viewDetector.observe).toHaveBeenCalledWith(seeded)
    expect(clickDetector.observe).not.toHaveBeenCalled()
    expect(hoverDetector.observe).not.toHaveBeenCalled()

    runtime.tracking.enable('clicks')
    expect(clickDetector.observe).toHaveBeenCalledWith(seeded)

    runtime.tracking.enable('hovers')
    expect(hoverDetector.observe).toHaveBeenCalledWith(seeded)
  })

  it('fans DOM insertions and removals out to running detectors', async () => {
    const { runtime, viewDetector } = createRuntime()

    runtime.tracking.enable('views')
    viewDetector.observe.mockClear()

    const el = makeNodeElement('dynamic')
    document.body.append(el)

    await Promise.resolve()
    await Promise.resolve()
    expect(viewDetector.observe).toHaveBeenCalledWith(el)

    document.body.removeChild(el)
    await Promise.resolve()
    await Promise.resolve()
    expect(viewDetector.unobserve).toHaveBeenCalledWith(el)
  })

  it('disables globally by clearing the auto-track flag', () => {
    const seeded = makeNodeElement()
    document.body.append(seeded)
    const { runtime, viewDetector } = createRuntime()

    runtime.tracking.enable('views')
    runtime.tracking.disable('views')

    expect(viewDetector.unobserve).toHaveBeenCalledWith(seeded)
  })

  it('runs a force-enabled element even when global auto-tracking is off', () => {
    const el = makeNodeElement()
    const { runtime, clickDetector } = createRuntime()

    runtime.tracking.enableElement('clicks', el)

    expect(clickDetector.observe).toHaveBeenCalledWith(el)
  })

  it('stops force-enabled-only interactions after clearing the final override', () => {
    const el = makeNodeElement()
    const { runtime, clickDetector } = createRuntime()

    runtime.tracking.enableElement('clicks', el)
    runtime.tracking.clearElement('clicks', el)

    expect(clickDetector.unobserve).toHaveBeenCalledWith(el)
  })

  it('skips force-disabled elements even when auto-tracking is on', () => {
    const seeded = makeNodeElement()
    document.body.append(seeded)
    const { runtime, viewDetector } = createRuntime()

    runtime.tracking.disableElement('views', seeded)
    runtime.tracking.enable('views')

    expect(viewDetector.observe).not.toHaveBeenCalled()
  })

  it('waits for consent before starting a globally-enabled interaction', () => {
    let allowed = false
    const seeded = makeNodeElement()
    document.body.append(seeded)
    const { runtime, viewDetector } = createRuntime((name) => name !== 'trackNodeView' || allowed)

    runtime.tracking.enable('views')
    expect(viewDetector.observe).not.toHaveBeenCalled()

    allowed = true
    runtime.syncAutoTrackedNodeInteractions()
    expect(viewDetector.observe).toHaveBeenCalledWith(seeded)
  })

  it('reset stops running interactions and clears element overrides', () => {
    const el = makeNodeElement()
    const { runtime, clickDetector } = createRuntime()

    runtime.tracking.enableElement('clicks', el)
    runtime.reset()
    runtime.tracking.clearElement('clicks', el)

    expect(clickDetector.unobserve).toHaveBeenCalledWith(el)
  })

  it('destroy disconnects the mutation observer and detectors', () => {
    const { runtime, viewDetector, clickDetector, hoverDetector } = createRuntime()
    runtime.tracking.enable('views')

    runtime.destroy()

    expect(viewDetector.disconnect).toHaveBeenCalledTimes(1)
    expect(clickDetector.disconnect).toHaveBeenCalledTimes(1)
    expect(hoverDetector.disconnect).toHaveBeenCalledTimes(1)
    expect(Reflect.get(runtime, 'nodeElementObserver')).toBeUndefined()
  })
})

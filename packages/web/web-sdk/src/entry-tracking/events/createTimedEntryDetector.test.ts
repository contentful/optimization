import { isEntryElement, type EntryElement } from '../resolveTrackingPayload'
import {
  createTimedEntryDetector,
  isHtmlOrSvgElement,
  parseNonNegativeNumber,
} from './createTimedEntryDetector'

interface TestInfo {
  data?: unknown
}

interface TestObserver {
  observe: ReturnType<typeof rs.fn>
  unobserve: ReturnType<typeof rs.fn>
  disconnect: ReturnType<typeof rs.fn>
}

const makeObserver = (): TestObserver => ({
  observe: rs.fn(),
  unobserve: rs.fn(),
  disconnect: rs.fn(),
})

const makeEntryElement = (id = 'entry-1'): EntryElement => {
  const element = document.createElement('div')
  element.setAttribute('data-ctfl-entry-id', id)
  document.body.appendChild(element)
  if (!isEntryElement(element)) {
    throw new Error('test setup: expected entry element')
  }
  return element
}

const noopTrack = async (): Promise<undefined> => {
  await Promise.resolve()
  return undefined
}

afterEach(() => {
  document.body.innerHTML = ''
  rs.restoreAllMocks()
  rs.unstubAllGlobals()
})

describe('isHtmlOrSvgElement', () => {
  it('returns true for HTMLElement', () => {
    expect(isHtmlOrSvgElement(document.createElement('div'))).toBe(true)
  })

  it('returns true for SVGElement', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    expect(isHtmlOrSvgElement(svg)).toBe(true)
  })

  it('returns false when HTMLElement is not defined', () => {
    rs.stubGlobal('HTMLElement', undefined)

    expect(isHtmlOrSvgElement(document.createElement('div'))).toBe(false)
  })

  it('returns false when SVGElement is not defined', () => {
    rs.stubGlobal('SVGElement', undefined)

    expect(isHtmlOrSvgElement(document.createElement('div'))).toBe(false)
  })
})

describe('parseNonNegativeNumber', () => {
  it('parses well-formed positive numbers', () => {
    expect(parseNonNegativeNumber('1500')).toBe(1500)
  })

  it('treats zero as a valid value', () => {
    expect(parseNonNegativeNumber('0')).toBe(0)
  })

  it('trims whitespace before parsing', () => {
    expect(parseNonNegativeNumber('  42  ')).toBe(42)
  })

  it('returns undefined for undefined input', () => {
    expect(parseNonNegativeNumber(undefined)).toBeUndefined()
  })

  it('returns undefined for empty or whitespace-only strings', () => {
    expect(parseNonNegativeNumber('')).toBeUndefined()
    expect(parseNonNegativeNumber('   ')).toBeUndefined()
  })

  it('returns undefined for non-numeric strings', () => {
    expect(parseNonNegativeNumber('not-a-number')).toBeUndefined()
  })

  it('returns undefined for negative numbers', () => {
    expect(parseNonNegativeNumber('-5')).toBeUndefined()
  })

  it('returns undefined for non-finite values', () => {
    expect(parseNonNegativeNumber('Infinity')).toBeUndefined()
  })
})

describe('createTimedEntryDetector', () => {
  it('disconnects observer and clears state on stop', () => {
    const observer = makeObserver()
    const detector = createTimedEntryDetector<
      unknown,
      undefined,
      undefined,
      TestInfo,
      TestObserver
    >({
      core: {},
      interaction: 'views',
      createObserver: () => observer,
      resolveAttributeOptions: () => undefined,
      track: noopTrack,
    })

    detector.start(undefined)

    const element = makeEntryElement()
    detector.enableElement?.(element)
    expect(observer.observe).toHaveBeenCalledWith(element, undefined)

    detector.stop()
    expect(observer.disconnect).toHaveBeenCalledTimes(1)

    observer.observe.mockClear()
    detector.enableElement?.(element)
    expect(observer.observe).not.toHaveBeenCalled()
  })

  it('observes entries added by auto-tracking and stops when removed', () => {
    const observer = makeObserver()
    const detector = createTimedEntryDetector<
      unknown,
      undefined,
      undefined,
      TestInfo,
      TestObserver
    >({
      core: {},
      interaction: 'views',
      createObserver: () => observer,
      resolveAttributeOptions: () => undefined,
      track: noopTrack,
    })

    detector.start(undefined)

    const element = makeEntryElement()
    detector.onEntryAdded?.(element)

    expect(observer.observe).toHaveBeenCalledWith(element, undefined)

    observer.observe.mockClear()
    detector.onEntryRemoved?.(element)

    expect(observer.unobserve).toHaveBeenCalledWith(element)
  })

  it('skips reapplying enableElement when called twice with same options', () => {
    const observer = makeObserver()
    const detector = createTimedEntryDetector<
      unknown,
      undefined,
      undefined,
      TestInfo,
      TestObserver
    >({
      core: {},
      interaction: 'views',
      createObserver: () => observer,
      resolveAttributeOptions: () => undefined,
      track: noopTrack,
    })

    detector.start(undefined)

    const element = makeEntryElement()
    detector.enableElement?.(element)
    expect(observer.observe).toHaveBeenCalledTimes(1)

    observer.observe.mockClear()
    detector.enableElement?.(element)
    expect(observer.observe).not.toHaveBeenCalled()
  })

  it('unobserves and re-observes when enableElement gets new options', () => {
    const observer = makeObserver()
    const detector = createTimedEntryDetector<
      unknown,
      undefined,
      Record<string, unknown>,
      TestInfo,
      TestObserver
    >({
      core: {},
      interaction: 'views',
      createObserver: () => observer,
      resolveAttributeOptions: () => undefined,
      track: noopTrack,
    })

    detector.start(undefined)

    const element = makeEntryElement()
    const firstOptions = { dwellTimeMs: 1000 }
    detector.enableElement?.(element, firstOptions)
    expect(observer.observe).toHaveBeenCalledWith(element, firstOptions)

    observer.observe.mockClear()
    observer.unobserve.mockClear()
    const secondOptions = { dwellTimeMs: 2000 }
    detector.enableElement?.(element, secondOptions)

    expect(observer.unobserve).toHaveBeenCalledWith(element)
    expect(observer.observe).toHaveBeenCalledWith(element, secondOptions)
  })

  it('does nothing when clearElement is called for an unknown override', () => {
    const observer = makeObserver()
    const detector = createTimedEntryDetector<
      unknown,
      undefined,
      undefined,
      TestInfo,
      TestObserver
    >({
      core: {},
      interaction: 'views',
      createObserver: () => observer,
      resolveAttributeOptions: () => undefined,
      track: noopTrack,
    })

    detector.start(undefined)

    const element = makeEntryElement()
    detector.clearElement?.(element)

    expect(observer.observe).not.toHaveBeenCalled()
    expect(observer.unobserve).not.toHaveBeenCalled()
  })

  it('reconciles overridden elements when setAuto changes', () => {
    const observer = makeObserver()
    const detector = createTimedEntryDetector<
      unknown,
      undefined,
      undefined,
      TestInfo,
      TestObserver
    >({
      core: {},
      interaction: 'views',
      createObserver: () => observer,
      resolveAttributeOptions: () => undefined,
      track: noopTrack,
    })

    detector.start(undefined)

    const auto = makeEntryElement('auto')
    const overridden = makeEntryElement('override')
    detector.onEntryAdded?.(auto)
    detector.enableElement?.(overridden)

    observer.observe.mockClear()
    observer.unobserve.mockClear()

    detector.setAuto?.(false)

    expect(observer.unobserve).toHaveBeenCalledWith(auto)
    expect(observer.observe).toHaveBeenCalledWith(overridden, undefined)
  })

  it('skips the track callback when payload cannot be resolved', async () => {
    const observer = makeObserver()
    let capturedCallback: ((element: Element, info: TestInfo) => Promise<void>) | undefined
    const track = rs.fn(noopTrack)
    const detector = createTimedEntryDetector<
      unknown,
      undefined,
      undefined,
      TestInfo,
      TestObserver
    >({
      core: {},
      interaction: 'views',
      createObserver: (callback) => {
        capturedCallback = callback
        return observer
      },
      resolveAttributeOptions: () => undefined,
      track,
    })

    detector.start(undefined)
    expect(capturedCallback).toBeDefined()

    const detached = document.createElement('div')
    await capturedCallback?.(detached, { data: undefined })

    expect(track).not.toHaveBeenCalled()
  })

  it('forwards payload to track when it can be resolved', async () => {
    const observer = makeObserver()
    let capturedCallback: ((element: Element, info: TestInfo) => Promise<void>) | undefined
    const track = rs.fn(noopTrack)
    const core = { tag: 'core' }
    const detector = createTimedEntryDetector<
      typeof core,
      undefined,
      undefined,
      TestInfo,
      TestObserver
    >({
      core,
      interaction: 'views',
      createObserver: (callback) => {
        capturedCallback = callback
        return observer
      },
      resolveAttributeOptions: () => undefined,
      track,
    })

    detector.start(undefined)
    expect(capturedCallback).toBeDefined()

    const element = makeEntryElement('entry-with-payload')
    const info: TestInfo = { data: undefined }
    await capturedCallback?.(element, info)

    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith(
      core,
      expect.objectContaining({ componentId: 'entry-with-payload' }),
      info,
      element,
    )
  })
})

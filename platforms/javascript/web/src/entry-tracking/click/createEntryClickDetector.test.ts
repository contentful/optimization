import { createEntryTrackingHarness } from '../../test/helpers'
import { createEntryClickDetector, type EntryClickTrackingCore } from './createEntryClickDetector'

type TrackComponentClickMock = ReturnType<typeof rs.fn>

function createCore(): {
  core: EntryClickTrackingCore
  trackComponentClick: TrackComponentClickMock
} {
  const trackComponentClick = rs.fn().mockResolvedValue(undefined)

  const core: EntryClickTrackingCore = {
    trackComponentClick,
  }

  return { core, trackComponentClick }
}

describe('EntryClickTracker', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    rs.restoreAllMocks()
  })

  it('tracks click when the entry element itself is clickable', () => {
    const button = document.createElement('button')
    button.dataset.ctflEntryId = 'entry-self-clickable'
    document.body.append(button)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    button.click()

    expect(trackComponentClick).toHaveBeenCalledTimes(1)
    expect(trackComponentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-self-clickable',
      }),
    )

    cleanup()
  })

  it('tracks click when the entry has a clickable ancestor', () => {
    const anchor = document.createElement('a')
    anchor.href = '#'

    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-clickable-ancestor'

    anchor.append(entry)
    document.body.append(anchor)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    entry.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(trackComponentClick).toHaveBeenCalledTimes(1)
    expect(trackComponentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-clickable-ancestor',
      }),
    )

    cleanup()
  })

  it('tracks click when it originates from a clickable descendant', () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-clickable-descendant'

    const clickableDescendant = document.createElement('button')
    entry.append(clickableDescendant)
    document.body.append(entry)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    clickableDescendant.click()

    expect(trackComponentClick).toHaveBeenCalledTimes(1)
    expect(trackComponentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-clickable-descendant',
      }),
    )

    cleanup()
  })

  it('does not track click when entry/ancestors/descendants are not clickable', () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-non-clickable'

    const plainDescendant = document.createElement('span')
    entry.append(plainDescendant)
    document.body.append(entry)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    plainDescendant.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(trackComponentClick).not.toHaveBeenCalled()

    cleanup()
  })

  it('prefers manual element data over dataset data', () => {
    const entry = document.createElement('button')
    entry.dataset.ctflEntryId = 'dataset-entry'
    document.body.append(entry)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    tracker.enableElement(entry, { data: { entryId: 'manual-entry' } })

    entry.click()

    expect(trackComponentClick).toHaveBeenCalledTimes(1)
    expect(trackComponentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'manual-entry',
      }),
    )

    cleanup()
  })

  it('falls back to auto-tracked dataset after manual untrack', () => {
    const entry = document.createElement('button')
    entry.dataset.ctflEntryId = 'dataset-entry'
    document.body.append(entry)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    tracker.enableElement(entry, { data: { entryId: 'manual-entry' } })
    tracker.clearElement(entry)

    entry.click()

    expect(trackComponentClick).toHaveBeenCalledTimes(1)
    expect(trackComponentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'dataset-entry',
      }),
    )

    cleanup()
  })

  it('treats onclick attribute as clickable', () => {
    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-onclick-attr'
    entry.setAttribute('onclick', 'void 0')
    document.body.append(entry)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    entry.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(trackComponentClick).toHaveBeenCalledTimes(1)
    expect(trackComponentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-onclick-attr',
      }),
    )

    cleanup()
  })

  it('treats onclick property handlers as clickable', () => {
    const wrapper = document.createElement('div')
    wrapper.onclick = () => undefined

    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'entry-onclick-prop'

    wrapper.append(entry)
    document.body.append(wrapper)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    entry.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(trackComponentClick).toHaveBeenCalledTimes(1)
    expect(trackComponentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-onclick-prop',
      }),
    )

    cleanup()
  })

  it('handles click events originating from a text node target', () => {
    const entry = document.createElement('button')
    entry.dataset.ctflEntryId = 'entry-text-target'
    const label = document.createTextNode('Click me')
    entry.append(label)
    document.body.append(entry)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    label.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(trackComponentClick).toHaveBeenCalledTimes(1)
    expect(trackComponentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'entry-text-target',
      }),
    )

    cleanup()
  })

  it('disables auto-tracked elements when explicitly disabled', () => {
    const entry = document.createElement('button')
    entry.dataset.ctflEntryId = 'dataset-entry'
    document.body.append(entry)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    tracker.disableElement(entry)

    entry.click()

    expect(trackComponentClick).not.toHaveBeenCalled()

    cleanup()
  })

  it('disables click tracking for auto-tracked entries via data-ctfl-track-clicks=false', () => {
    const entry = document.createElement('button')
    entry.dataset.ctflEntryId = 'dataset-entry'
    entry.dataset.ctflTrackClicks = 'false'
    document.body.append(entry)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    entry.click()

    expect(trackComponentClick).not.toHaveBeenCalled()

    cleanup()
  })

  it('force-enables click tracking via data-ctfl-track-clicks=true when auto-tracking is disabled', () => {
    const entry = document.createElement('button')
    entry.dataset.ctflEntryId = 'dataset-entry'
    entry.dataset.ctflTrackClicks = 'true'
    document.body.append(entry)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.setAuto(false)
    tracker.start()
    entry.click()

    expect(trackComponentClick).toHaveBeenCalledTimes(1)
    expect(trackComponentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'dataset-entry',
      }),
    )

    cleanup()
  })

  it('uses manual click overrides over data attributes and falls back after clear', () => {
    const entry = document.createElement('button')
    entry.dataset.ctflEntryId = 'dataset-entry'
    entry.dataset.ctflTrackClicks = 'false'
    document.body.append(entry)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    tracker.enableElement(entry, { data: { entryId: 'manual-entry' } })
    entry.click()
    tracker.clearElement(entry)
    entry.click()

    expect(trackComponentClick).toHaveBeenCalledTimes(1)
    expect(trackComponentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'manual-entry',
      }),
    )

    cleanup()
  })

  it('keeps manual data after auto-add when force-enabled before start', () => {
    const entry = document.createElement('button')
    entry.dataset.ctflEntryId = 'dataset-before-start'
    document.body.append(entry)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.enableElement(entry, { data: { entryId: 'manual-before-start' } })
    tracker.start()
    entry.click()

    expect(trackComponentClick).toHaveBeenCalledTimes(1)
    expect(trackComponentClick).toHaveBeenCalledWith(
      expect.objectContaining({
        componentId: 'manual-before-start',
      }),
    )

    cleanup()
  })

  it('stops tracking removed auto entries after mutation processing', async () => {
    const entry = document.createElement('button')
    entry.dataset.ctflEntryId = 'entry-removed'
    document.body.append(entry)

    const { core, trackComponentClick } = createCore()
    const { cleanup, tracker } = createEntryTrackingHarness(createEntryClickDetector(core))

    tracker.start()
    entry.click()

    document.body.removeChild(entry)
    await Promise.resolve()
    await Promise.resolve()

    entry.click()

    expect(trackComponentClick).toHaveBeenCalledTimes(1)

    cleanup()
  })
})

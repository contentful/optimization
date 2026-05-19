const { expect: jestExpect } = require('expect')
const {
  clearProfileState,
  ELEMENT_VISIBILITY_TIMEOUT,
  getElementTextById,
  tapIfVisibleById,
  waitForTextChangeById,
  waitForTextEqualsById,
} = require('./helpers')

// Pattern that the `*-entry-id` Text nodes render via LiveUpdatesEntryDisplay.tsx:23.
// The id segment after "Entry: " is a Contentful sys.id (alphanumeric, no spaces).
// Asserting against this proves the SDK actually resolved an entry rather than
// rendering an empty/default state.
const ENTRY_ID_TEXT_PATTERN = /^Entry: [a-zA-Z0-9]+$/

describe('live updates behavior', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState()

    await waitFor(element(by.id('live-updates-test-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await element(by.id('live-updates-test-button')).tap()

    await waitFor(element(by.id('default-optimization')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  afterEach(async () => {
    await tapIfVisibleById('close-live-updates-test-button')

    await waitFor(element(by.id('live-updates-test-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  describe('default behavior (locked on first value)', () => {
    it('should NOT update variant when user identifies (global liveUpdates=false)', async () => {
      // Capture the SDK-resolved entry id for both the locked default section
      // and the always-live reference section.
      await waitFor(element(by.id('default-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
      await waitFor(element(by.id('live-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      const initialDefaultEntryIdText = await getElementTextById('default-entry-id')
      const initialLiveEntryIdText = await getElementTextById('live-entry-id')

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      // The live-prefixed section has liveUpdates=true, so it MUST re-resolve to a
      // different variant after identify. If this fails, either the SDK is not
      // re-resolving on profile change or the fixture doesn't differentiate
      // anonymous from charles — in either case, the "locked stays locked"
      // assertion below would be meaningless without this proof.
      await waitForTextChangeById('live-entry-id', initialLiveEntryIdText)

      // Default section inherits the global setting (off), so the lock must hold.
      await waitForTextEqualsById('default-entry-id', initialDefaultEntryIdText)
    })
  })

  describe('global liveUpdates enabled', () => {
    it('should update default entries when user identifies', async () => {
      await element(by.id('toggle-global-live-updates-button')).tap()

      await waitFor(element(by.id('global-live-updates-status')))
        .toHaveText('ON')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('default-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      const initialDefaultEntryIdText = await getElementTextById('default-entry-id')

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitForTextChangeById('default-entry-id', initialDefaultEntryIdText)
    })

    it('should NOT update locked entries even when global liveUpdates=true', async () => {
      await element(by.id('toggle-global-live-updates-button')).tap()

      await waitFor(element(by.id('global-live-updates-status')))
        .toHaveText('ON')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('locked-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
      await waitFor(element(by.id('default-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      const initialLockedEntryIdText = await getElementTextById('locked-entry-id')
      const initialDefaultEntryIdText = await getElementTextById('default-entry-id')

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      // With global=ON the default section (no per-component prop) MUST re-resolve.
      // This is the live-reference that proves the SDK is actually swapping variants.
      await waitForTextChangeById('default-entry-id', initialDefaultEntryIdText)

      // Locked section has liveUpdates=false, so it must stay at its captured id.
      await waitForTextEqualsById('locked-entry-id', initialLockedEntryIdText)
    })
  })

  describe('per-component liveUpdates=true', () => {
    it('should update variant regardless of global setting', async () => {
      await waitFor(element(by.id('global-live-updates-status')))
        .toHaveText('OFF')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('live-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      const initialLiveEntryIdText = await getElementTextById('live-entry-id')

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitForTextChangeById('live-entry-id', initialLiveEntryIdText)
    })
  })

  describe('per-component liveUpdates=false', () => {
    it('should NOT update variant even when global liveUpdates=true', async () => {
      await element(by.id('toggle-global-live-updates-button')).tap()

      await waitFor(element(by.id('global-live-updates-status')))
        .toHaveText('ON')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('locked-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
      await waitFor(element(by.id('live-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      const initialLockedEntryIdText = await getElementTextById('locked-entry-id')
      const initialLiveEntryIdText = await getElementTextById('live-entry-id')

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      // Live section (per-component liveUpdates=true) MUST change — the SDK is
      // re-resolving on identify. The per-component prop is the path under test:
      // it must override the global=true setting and keep the locked section stable.
      await waitForTextChangeById('live-entry-id', initialLiveEntryIdText)
      await waitForTextEqualsById('locked-entry-id', initialLockedEntryIdText)
    })
  })

  describe('preview panel simulation', () => {
    it('should enable live updates for all entries when panel is open', async () => {
      await waitFor(element(by.id('preview-panel-status')))
        .toHaveText('Closed')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await element(by.id('simulate-preview-panel-button')).tap()

      await waitFor(element(by.id('preview-panel-status')))
        .toHaveText('Open')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('default-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
      await waitFor(element(by.id('live-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
      await waitFor(element(by.id('locked-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      const initialDefaultEntryIdText = await getElementTextById('default-entry-id')
      const initialLiveEntryIdText = await getElementTextById('live-entry-id')
      const initialLockedEntryIdText = await getElementTextById('locked-entry-id')

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      // While the preview panel is open, OptimizedEntry.tsx:229-231 forces
      // shouldLiveUpdate=true for ALL sections, including the per-component
      // liveUpdates=false one. All three resolved variants must change.
      await waitForTextChangeById('default-entry-id', initialDefaultEntryIdText)
      await waitForTextChangeById('live-entry-id', initialLiveEntryIdText)
      await waitForTextChangeById('locked-entry-id', initialLockedEntryIdText)
    })
  })

  describe('screen controls', () => {
    it('should toggle global live updates setting', async () => {
      await expect(element(by.id('global-live-updates-status'))).toHaveText('OFF')

      await element(by.id('toggle-global-live-updates-button')).tap()

      await waitFor(element(by.id('global-live-updates-status')))
        .toHaveText('ON')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await element(by.id('toggle-global-live-updates-button')).tap()

      await waitFor(element(by.id('global-live-updates-status')))
        .toHaveText('OFF')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
    })

    it('should toggle preview panel simulation', async () => {
      await expect(element(by.id('preview-panel-status'))).toHaveText('Closed')

      await element(by.id('simulate-preview-panel-button')).tap()

      await waitFor(element(by.id('preview-panel-status')))
        .toHaveText('Open')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await element(by.id('simulate-preview-panel-button')).tap()

      await waitFor(element(by.id('preview-panel-status')))
        .toHaveText('Closed')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
    })

    it('should identify and reset user', async () => {
      await expect(element(by.id('identified-status'))).toHaveText('No')

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await element(by.id('live-updates-reset-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('No')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
    })
  })

  describe('three Optimization sections display', () => {
    it('should display all three Optimization entry sections', async () => {
      await waitFor(element(by.id('default-optimization')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('live-optimization')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('locked-optimization')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      // Section wrappers render unconditionally from JSX — proving they're
      // mounted is just a smoke check. The SDK responsibility is to feed each
      // section a resolved entry whose sys.id surfaces in the entry-id Text.
      await waitFor(element(by.id('default-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
      await waitFor(element(by.id('live-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
      await waitFor(element(by.id('locked-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      const defaultEntryIdText = await getElementTextById('default-entry-id')
      const liveEntryIdText = await getElementTextById('live-entry-id')
      const lockedEntryIdText = await getElementTextById('locked-entry-id')

      jestExpect(defaultEntryIdText).toMatch(ENTRY_ID_TEXT_PATTERN)
      jestExpect(liveEntryIdText).toMatch(ENTRY_ID_TEXT_PATTERN)
      jestExpect(lockedEntryIdText).toMatch(ENTRY_ID_TEXT_PATTERN)
    })

    it('should display entry content in all sections', async () => {
      await waitFor(element(by.id('default-container')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('live-container')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('locked-container')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      const defaultText = await getElementTextById('default-text')
      const liveText = await getElementTextById('live-text')
      const lockedText = await getElementTextById('locked-text')

      // LiveUpdatesEntryDisplay.tsx:15 falls back to 'No content' when the
      // resolved entry has no text field — a non-empty text that isn't the
      // fallback proves the SDK fed a real field value.
      jestExpect(defaultText.length).toBeGreaterThan(0)
      jestExpect(liveText.length).toBeGreaterThan(0)
      jestExpect(lockedText.length).toBeGreaterThan(0)
      jestExpect(defaultText).not.toBe('No content')
      jestExpect(liveText).not.toBe('No content')
      jestExpect(lockedText).not.toBe('No content')

      // All three sections wrap the same Contentful entry, so before any
      // identify/toggle/preview-panel actions they MUST resolve to the same
      // variant — anything else means the lock semantics are inconsistent
      // between sections at first render.
      jestExpect(defaultText).toBe(liveText)
      jestExpect(defaultText).toBe(lockedText)
    })
  })
})

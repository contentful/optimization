/**
 * Cross-platform preview-panel override scenarios.
 *
 * Scenarios mirror `implementations/PREVIEW_PANEL_SCENARIOS.md` and the iOS
 * `PreviewPanelOverridesTests` XCUITest suite. Keep scenario names and
 * data identical so cross-platform regressions are visible in CI diff.
 */

const {
  clearProfileState,
  ELEMENT_VISIBILITY_TIMEOUT,
  isVisibleById,
  tapAlertButton,
} = require('./helpers')

const AUDIENCE_ID = '4yIqY7AWtzeehCZxtQSDB'
const EXPERIENCE_ID = '7DyidZaPB7Jr1gWKjoogg0'
const VARIANT_ENTRY_ID = '5a8ONfBdanJtlJ39WWnH1w'
const BASELINE_ENTRY_ID = '5i4SdJXw9oDEY0vgO7CwF4'

// Scenario 1 reuses the Mobile Browser audience, which the identified user does
// NOT qualify for. The associated experience is the first entry in the
// `nt_experiences` array of baseline xFwgG3oNaOcjzWiGe4vXo (see
// lib/mocks/src/contentful/data/entries/xFwgG3oNaOcjzWiGe4vXo.json), so
// `OptimizedEntryResolver` picks it deterministically once activated.
//
// xFwgG3oNaOcjzWiGe4vXo renders through the demo app's top-level `ContentEntry`
// (sections/ContentEntry.tsx), whose testID is keyed on the *original* entry
// id and stays constant across resolution. So scenario 1 asserts on the
// resolved entry's accessibilityLabel (variant text + original baseline id)
// — that label changes when the override flips the resolved variant.
const UNQUALIFIED_AUDIENCE_ID = '3MRuZPQ5EdwDqzUDRgOo7c'
const MOBILE_VARIANT_LABEL =
  'This is a variant content entry for visitors using a mobile browser. [Entry: xFwgG3oNaOcjzWiGe4vXo]'

async function identifyAndRelaunch() {
  await waitFor(element(by.id('identify-button')))
    .toBeVisible()
    .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  await element(by.id('identify-button')).tap()
  await waitFor(element(by.id('reset-button')))
    .toBeVisible()
    .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  // Existing identified-variant tests terminate+relaunch here so the app
  // re-fetches the identified-visitor mock payload on fresh launch.
  await device.terminateApp()
  await device.launchApp({ newInstance: true })
  // Identified-visitor profile should render variant entries by default.
  await waitFor(element(by.id(`entry-text-${VARIANT_ENTRY_ID}`)))
    .toExist()
    .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
}

async function openPanel() {
  await waitFor(element(by.id('preview-panel-fab')))
    .toExist()
    .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  await element(by.id('preview-panel-fab')).tap()
  await waitFor(element(by.text('Preview Panel')))
    .toBeVisible()
    .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
}

/**
 * Scrolls the preview panel's internal ScrollView until the target element
 * is visible enough to be tappable. The panel is tall and target audiences
 * are typically below the fold.
 */
async function scrollPanelToId(testId) {
  await waitFor(element(by.id(testId)))
    .toBeVisible()
    .whileElement(by.id('preview-panel-scroll'))
    .scroll(300, 'down')
}

async function closePanel() {
  // Press system back to dismiss the modal; this fires onRequestClose on Android
  // and the standard swipe-to-dismiss on iOS.
  try {
    await device.pressBack()
  } catch {
    // iOS has no hardware back; fall back to our close button testID.
    if (await isVisibleById('preview-panel-close', 1000)) {
      await element(by.id('preview-panel-close')).tap()
    }
  }
}

describe('preview panel overrides', () => {
  // Launch fresh before every scenario so modal state and override state
  // from a prior scenario can't leak into the next one.
  beforeEach(async () => {
    await device.launchApp({ newInstance: true, delete: true })
    await clearProfileState()
    await identifyAndRelaunch()
  })

  it('scenario 1: activating unqualified audience renders its variant', async () => {
    await openPanel()
    await scrollPanelToId(`audience-toggle-${UNQUALIFIED_AUDIENCE_ID}-on`)
    await element(by.id(`audience-toggle-${UNQUALIFIED_AUDIENCE_ID}-on`)).tap()
    await closePanel()

    await waitFor(element(by.label(MOBILE_VARIANT_LABEL)))
      .toExist()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  it('scenario 2: deactivating qualified audience renders baseline', async () => {
    await openPanel()
    await scrollPanelToId(`audience-toggle-${AUDIENCE_ID}-off`)
    await element(by.id(`audience-toggle-${AUDIENCE_ID}-off`)).tap()
    await closePanel()
    // Wait briefly for the signal update to propagate into re-rendered entries.
    await waitFor(element(by.id(`entry-text-${BASELINE_ENTRY_ID}`)))
      .toExist()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  it('scenario 3: resetting audience override restores variant', async () => {
    // First deactivate so there is an override to reset.
    await openPanel()
    await scrollPanelToId(`audience-toggle-${AUDIENCE_ID}-off`)
    await element(by.id(`audience-toggle-${AUDIENCE_ID}-off`)).tap()
    await element(by.id(`audience-toggle-${AUDIENCE_ID}-default`)).tap()
    await closePanel()

    await waitFor(element(by.id(`entry-text-${VARIANT_ENTRY_ID}`)))
      .toExist()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  it('scenario 4: setting variant override to 0 renders baseline', async () => {
    await openPanel()
    // The audience must be expanded for its experience variant picker to mount.
    await scrollPanelToId(`audience-toggle-${AUDIENCE_ID}-off`)
    // Tap audience header row to expand experiences.
    await element(by.text('Identified Users')).tap()
    await scrollPanelToId(`variant-picker-${EXPERIENCE_ID}-0`)
    await element(by.id(`variant-picker-${EXPERIENCE_ID}-0`)).tap()
    await closePanel()

    await waitFor(element(by.id(`entry-text-${BASELINE_ENTRY_ID}`)))
      .toExist()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  it('scenario 5: resetting single variant override restores variant', async () => {
    // Drive scenario 4 first so a variant override exists in the Overrides section.
    await openPanel()
    await scrollPanelToId(`audience-toggle-${AUDIENCE_ID}-off`)
    await element(by.text('Identified Users')).tap()
    await scrollPanelToId(`variant-picker-${EXPERIENCE_ID}-0`)
    await element(by.id(`variant-picker-${EXPERIENCE_ID}-0`)).tap()

    // Tap the per-experience reset and confirm the native Alert.
    await scrollPanelToId(`reset-variant-${EXPERIENCE_ID}`)
    await element(by.id(`reset-variant-${EXPERIENCE_ID}`)).tap()
    await tapAlertButton('Reset')
    await closePanel()

    await waitFor(element(by.id(`entry-text-${VARIANT_ENTRY_ID}`)))
      .toExist()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  it('scenario 6: reset-all restores variant content', async () => {
    // Set a variant override, then reset all.
    await openPanel()
    await scrollPanelToId(`audience-toggle-${AUDIENCE_ID}-off`)
    await element(by.text('Identified Users')).tap()
    await scrollPanelToId(`variant-picker-${EXPERIENCE_ID}-0`)
    await element(by.id(`variant-picker-${EXPERIENCE_ID}-0`)).tap()
    await scrollPanelToId('reset-all-overrides')
    await element(by.id('reset-all-overrides')).tap()
    // Confirmation is now an inline view inside the panel modal, so the
    // confirm button is reachable by testID on both platforms.
    await waitFor(element(by.id('reset-all-confirm')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
    await element(by.id('reset-all-confirm')).tap()
    await closePanel()

    await waitFor(element(by.id(`entry-text-${VARIANT_ENTRY_ID}`)))
      .toExist()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  it('scenario 7: override survives API refresh', async () => {
    // Apply scenario 2 (audience deactivated → baseline rendering), then drive
    // the in-panel Refresh to force a re-hit of the experience API. The
    // override interceptor must preserve the audience override across the push.
    await openPanel()
    await scrollPanelToId(`audience-toggle-${AUDIENCE_ID}-off`)
    await element(by.id(`audience-toggle-${AUDIENCE_ID}-off`)).tap()
    await scrollPanelToId('preview-refresh-button')
    await element(by.id('preview-refresh-button')).tap()
    await closePanel()

    await waitFor(element(by.id(`entry-text-${BASELINE_ENTRY_ID}`)))
      .toExist()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  it('scenario 8: destroy/remount clears overrides', async () => {
    // Apply scenario 2 override (deactivate audience → baseline rendering).
    await openPanel()
    await scrollPanelToId(`audience-toggle-${AUDIENCE_ID}-off`)
    await element(by.id(`audience-toggle-${AUDIENCE_ID}-off`)).tap()
    await closePanel()
    await waitFor(element(by.id(`entry-text-${BASELINE_ENTRY_ID}`)))
      .toExist()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // Cold relaunch with fresh storage and re-identify, mirroring beforeEach.
    await device.terminateApp()
    await device.launchApp({ newInstance: true, delete: true })
    await identifyAndRelaunch()

    // Override should be gone — variant renders again.
    await waitFor(element(by.id(`entry-text-${VARIANT_ENTRY_ID}`)))
      .toExist()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    // And the Overrides section should be empty. The empty-state text sits
    // below the fold in the panel ScrollView, so scroll the footer into view
    // first — that pulls OverridesSection (rendered just above it) into the
    // visible viewport.
    await openPanel()
    await scrollPanelToId('reset-all-overrides')
    await expect(element(by.text('No active overrides'))).toExist()
    await closePanel()
  })
})

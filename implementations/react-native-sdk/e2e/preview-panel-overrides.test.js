/**
 * Cross-platform preview-panel override scenarios.
 *
 * Scenarios mirror `implementations/PREVIEW_PANEL_SCENARIOS.md` and the iOS
 * `PreviewPanelOverridesTests` XCUITest suite. Keep scenario names and
 * data identical so cross-platform regressions are visible in CI diff.
 */

const { clearProfileState, ELEMENT_VISIBILITY_TIMEOUT, isVisibleById } = require('./helpers')

const AUDIENCE_ID = '4yIqY7AWtzeehCZxtQSDB'
const EXPERIENCE_ID = '7DyidZaPB7Jr1gWKjoogg0'
const VARIANT_ENTRY_ID = '5a8ONfBdanJtlJ39WWnH1w'
const BASELINE_ENTRY_ID = '5i4SdJXw9oDEY0vgO7CwF4'

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
    .whileElement(by.type('android.widget.ScrollView'))
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

  it('scenario 6: reset-all restores variant content', async () => {
    // Set a variant override, then reset all.
    await openPanel()
    await scrollPanelToId(`audience-toggle-${AUDIENCE_ID}-off`)
    await element(by.text('Identified Users')).tap()
    await scrollPanelToId(`variant-picker-${EXPERIENCE_ID}-0`)
    await element(by.id(`variant-picker-${EXPERIENCE_ID}-0`)).tap()
    await scrollPanelToId('reset-all-overrides')
    await element(by.id('reset-all-overrides')).tap()
    // Confirm alert.
    await waitFor(element(by.text('Reset')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
    await element(by.text('Reset')).atIndex(0).tap()
    await closePanel()

    await waitFor(element(by.id(`entry-text-${VARIANT_ENTRY_ID}`)))
      .toExist()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  // TODO: scenarios 1, 5, 7, 8 — see implementations/PREVIEW_PANEL_SCENARIOS.md.
  // - 1 (activate unqualified audience) requires a mock audience the identified user does not qualify for.
  // - 5 (reset single variant override) requires tapping the per-item reset button inside the Overrides section.
  // - 7 (override survives API refresh) drives the existing preview-refresh-button.
  // - 8 (destroy/remount) uses device.terminateApp() + device.launchApp({ delete: true }).
})

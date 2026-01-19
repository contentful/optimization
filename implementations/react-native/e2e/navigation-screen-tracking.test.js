const { expect: jestExpect } = require('expect')
const { clearProfileState, ELEMENT_VISIBILITY_TIMEOUT } = require('./helpers')

jest.setTimeout(180000)

async function getScreenEventLogText() {
  const attributes = await element(by.id('screen-event-log')).getAttributes()
  return attributes.text || attributes.label || ''
}

describe('navigation screen tracking', () => {
  beforeAll(async () => {
    await device.launchApp()
    await device.disableSynchronization()
  })

  beforeEach(async () => {
    await clearProfileState()
  })

  afterAll(async () => {
    await device.enableSynchronization()
  })

  it('should track a single view visit', async () => {
    await waitFor(element(by.id('navigation-test-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await element(by.id('navigation-test-button')).tap()

    await waitFor(element(by.id('go-to-view-one-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await element(by.id('go-to-view-one-button')).tap()

    await waitFor(element(by.id('navigation-view-test-one')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await waitFor(element(by.id('screen-event-log')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    const screenEventLogText = await getScreenEventLogText()
    jestExpect(screenEventLogText).toBe('NavigationViewOne')
  })

  it('should track multiple view visits in order', async () => {
    await waitFor(element(by.id('navigation-test-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await element(by.id('navigation-test-button')).tap()

    await waitFor(element(by.id('go-to-view-one-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await element(by.id('go-to-view-one-button')).tap()

    await waitFor(element(by.id('navigation-view-test-one')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await waitFor(element(by.id('go-to-view-two-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await element(by.id('go-to-view-two-button')).tap()

    await waitFor(element(by.id('navigation-view-test-two')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await waitFor(element(by.id('screen-event-log')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    const screenEventLogText = await getScreenEventLogText()
    const viewOneIndex = screenEventLogText.indexOf('NavigationViewOne')
    const viewTwoIndex = screenEventLogText.indexOf('NavigationViewTwo')

    jestExpect(viewOneIndex).toBeGreaterThanOrEqual(0)
    jestExpect(viewTwoIndex).toBeGreaterThan(viewOneIndex)
  })

  it('should track revisiting view one after view two', async () => {
    await waitFor(element(by.id('navigation-test-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await element(by.id('navigation-test-button')).tap()

    await waitFor(element(by.id('go-to-view-one-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await element(by.id('go-to-view-one-button')).tap()

    await waitFor(element(by.id('navigation-view-test-one')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await waitFor(element(by.id('go-to-view-two-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await element(by.id('go-to-view-two-button')).tap()

    await waitFor(element(by.id('navigation-view-test-two')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await device.pressBack()

    await waitFor(element(by.id('navigation-view-test-one')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    await waitFor(element(by.id('screen-event-log')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

    const screenEventLogText = await getScreenEventLogText()
    jestExpect(screenEventLogText).toBe('NavigationViewOne,NavigationViewTwo,NavigationViewOne')
  })
})

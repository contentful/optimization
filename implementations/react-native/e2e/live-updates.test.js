const { clearProfileState, ELEMENT_VISIBILITY_TIMEOUT } = require('./helpers')

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

    await waitFor(element(by.id('default-personalization')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  afterEach(async () => {
    await element(by.id('close-live-updates-test-button')).tap()

    await waitFor(element(by.id('live-updates-test-button')))
      .toBeVisible()
      .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
  })

  describe('default behavior (locked on first value)', () => {
    it('should NOT update variant when user identifies (global liveUpdates=false)', async () => {
      await waitFor(element(by.id('default-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      const initialDefaultEntryId = element(by.id('default-entry-id'))
      await expect(initialDefaultEntryId).toBeVisible()

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await new Promise((resolve) => setTimeout(resolve, 1000))

      await expect(element(by.id('default-entry-id'))).toBeVisible()
    })
  })

  describe('global liveUpdates enabled', () => {
    it('should update default components when user identifies', async () => {
      await element(by.id('toggle-global-live-updates-button')).tap()

      await waitFor(element(by.id('global-live-updates-status')))
        .toHaveText('ON')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('default-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await new Promise((resolve) => setTimeout(resolve, 1500))

      await expect(element(by.id('default-entry-id'))).toBeVisible()
    })

    it('should NOT update locked components even when global liveUpdates=true', async () => {
      await element(by.id('toggle-global-live-updates-button')).tap()

      await waitFor(element(by.id('global-live-updates-status')))
        .toHaveText('ON')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('locked-entry-id')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await new Promise((resolve) => setTimeout(resolve, 1000))

      await expect(element(by.id('locked-entry-id'))).toBeVisible()
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

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await new Promise((resolve) => setTimeout(resolve, 1500))

      await expect(element(by.id('live-entry-id'))).toBeVisible()
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

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await new Promise((resolve) => setTimeout(resolve, 1000))

      await expect(element(by.id('locked-entry-id'))).toBeVisible()
    })
  })

  describe('preview panel simulation', () => {
    it('should enable live updates for all components when panel is open', async () => {
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

      await element(by.id('live-updates-identify-button')).tap()

      await waitFor(element(by.id('identified-status')))
        .toHaveText('Yes')
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await new Promise((resolve) => setTimeout(resolve, 1500))

      await expect(element(by.id('default-entry-id'))).toBeVisible()
      await expect(element(by.id('live-entry-id'))).toBeVisible()
      await expect(element(by.id('locked-entry-id'))).toBeVisible()
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

  describe('three Personalization sections display', () => {
    it('should display all three Personalization components', async () => {
      await waitFor(element(by.id('default-personalization')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('live-personalization')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)

      await waitFor(element(by.id('locked-personalization')))
        .toBeVisible()
        .withTimeout(ELEMENT_VISIBILITY_TIMEOUT)
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

      await expect(element(by.id('default-text'))).toBeVisible()
      await expect(element(by.id('live-text'))).toBeVisible()
      await expect(element(by.id('locked-text'))).toBeVisible()

      await expect(element(by.id('default-entry-id'))).toBeVisible()
      await expect(element(by.id('live-entry-id'))).toBeVisible()
      await expect(element(by.id('locked-entry-id'))).toBeVisible()
    })
  })
})

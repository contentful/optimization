const { clearProfileState } = require('./helpers')

describe('Personalization Section', () => {
  beforeAll(async () => {
    await device.launchApp()
  })

  beforeEach(async () => {
    await clearProfileState()
  })

  describe('Personalization Rendering', () => {
    it('should display content text', async () => {
      await waitFor(element(by.id('personalization-content-text')))
        .toBeVisible()
        .withTimeout(10000)
    })

    it('should track and display component impression event', async () => {
      await waitFor(element(by.id('personalization-content')))
        .toBeVisible()
        .withTimeout(10000)

      await waitFor(element(by.id('personalization-event-component-2Z2WLOx07InSewC3LUB3eX')))
        .toBeVisible()
        .withTimeout(10000)
    })
  })
})

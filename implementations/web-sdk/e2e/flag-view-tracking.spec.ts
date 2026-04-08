import { expect, test, type Locator, type Page } from '@playwright/test'

function getFlagAccessEvents(page: Page): Locator {
  return page
    .locator('#event-stream li button[data-component-id="boolean"]')
    .filter({ hasText: /^component$/ })
}

test.describe('flag view tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: 'Accept Consent' }).click()
  })

  test('flag access emits a flag view event', async ({ page }) => {
    const flagAccessEvents = getFlagAccessEvents(page)
    const baselineFlagEventCount = await flagAccessEvents.count()

    await page.getByRole('button', { name: 'Identify' }).click()
    await expect(page.getByRole('button', { name: 'Reset Profile' })).toBeVisible()

    await expect
      .poll(async () => await flagAccessEvents.count(), {
        message: 'flag access should append a flag view event in the event stream',
      })
      .toBeGreaterThan(baselineFlagEventCount)

    const latestFlagAccessEvent = flagAccessEvents.last()

    await expect(latestFlagAccessEvent).toHaveText('component')
    expect(await latestFlagAccessEvent.getAttribute('data-view-id')).toBeNull()
  })
})

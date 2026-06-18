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
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
  })

  test('does not emit flag view events without consent', async ({ page }) => {
    const flagAccessEvents = getFlagAccessEvents(page)

    await expect(flagAccessEvents).toHaveCount(0)

    await page.getByRole('button', { name: 'Identify' }).click()
    await expect(page.getByRole('button', { name: 'Reset Profile' })).toBeVisible()

    await expect(flagAccessEvents).toHaveCount(0)
  })

  test('emits flag view events after consent and profile updates', async ({ page }) => {
    const flagAccessEvents = getFlagAccessEvents(page)
    const baselineFlagEventCount = await flagAccessEvents.count()

    await page.getByRole('button', { name: 'Accept Consent' }).click()

    await expect
      .poll(async () => await flagAccessEvents.count(), {
        message: 'consented flag subscription should append a flag view event',
      })
      .toBeGreaterThan(baselineFlagEventCount)

    const afterConsentFlagEventCount = await flagAccessEvents.count()

    await page.getByRole('button', { name: 'Identify' }).click()
    await expect(page.getByRole('button', { name: 'Reset Profile' })).toBeVisible()

    await expect
      .poll(async () => await flagAccessEvents.count(), {
        message: 'profile updates should append additional flag view events',
      })
      .toBeGreaterThan(afterConsentFlagEventCount)

    const latestFlagAccessEvent = flagAccessEvents.last()

    await expect(latestFlagAccessEvent).toHaveText('component')
    expect(await latestFlagAccessEvent.getAttribute('data-view-id')).toBeNull()
  })
})

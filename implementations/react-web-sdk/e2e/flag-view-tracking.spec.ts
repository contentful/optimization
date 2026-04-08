import { expect, test } from '@playwright/test'

test.describe('flag view tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
  })

  test('does not emit flag view events without consent', async ({ page }) => {
    const flagEvents = page.locator('[data-testid="event-component-boolean"]')

    await expect(flagEvents).toHaveCount(0)

    await page.getByTestId('live-updates-identify-button').click()
    await expect(page.getByTestId('live-updates-reset-button')).toBeVisible()

    await expect(flagEvents).toHaveCount(0)
  })

  test('emits flag view events after consent and profile updates', async ({ page }) => {
    const flagEvents = page.locator('[data-testid="event-component-boolean"]')
    const baselineFlagEventCount = await flagEvents.count()

    await page.getByTestId('consent-button').click()

    await expect
      .poll(async () => await flagEvents.count(), {
        message: 'consented flag subscription should emit a flag view event',
      })
      .toBeGreaterThan(baselineFlagEventCount)

    const afterConsentFlagEventCount = await flagEvents.count()

    await page.getByTestId('live-updates-identify-button').click()
    await expect(page.getByTestId('live-updates-reset-button')).toBeVisible()

    await expect
      .poll(async () => await flagEvents.count(), {
        message: 'profile updates should emit additional flag view events',
      })
      .toBeGreaterThan(afterConsentFlagEventCount)
  })
})

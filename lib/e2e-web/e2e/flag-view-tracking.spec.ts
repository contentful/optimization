import { expect, test } from '@playwright/test'

test.describe('flag view tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
  })

  test('does not emit flag view events without consent', async ({ page }) => {
    const flagEvents = page.locator('[data-testid="event-component-boolean"]')

    // no events on page load
    await expect(flagEvents).toHaveCount(0)

    // identifying without consent must not record flag exposure
    await page.getByTestId('identify-button').click()
    await expect(page.getByTestId('reset-button')).toBeVisible()

    await expect(flagEvents).toHaveCount(0)
  })

  test('emits flag view event on consent grant for identified user — anonymous exposure must be recorded for complete experiment analysis', async ({
    page,
  }) => {
    const flagEvents = page.locator('[data-testid="event-component-boolean"]')

    // identify first — flag value updates but no event because no consent yet
    await page.getByTestId('identify-button').click()
    await expect(page.getByTestId('reset-button')).toBeVisible()
    await expect(flagEvents).toHaveCount(0)

    // consent opens a fresh subscription which emits the current flag value immediately,
    // recording exposure even though identity was already established before consent
    await page.getByTestId('consent-button').click()

    await expect
      .poll(async () => await flagEvents.count(), {
        message: 'granting consent after identify should still emit a flag view event',
      })
      .toBeGreaterThan(0)
  })

  test('emits flag view event on consent for anonymous user, then again after identify — each profile change re-records exposure', async ({
    page,
  }) => {
    const flagEvents = page.locator('[data-testid="event-component-boolean"]')
    const baselineFlagEventCount = await flagEvents.count()

    // consent while anonymous — records the anonymous user's exposure
    await page.getByTestId('consent-button').click()

    await expect
      .poll(async () => await flagEvents.count(), {
        message: 'consented flag subscription should emit a flag view event',
      })
      .toBeGreaterThan(baselineFlagEventCount)

    const afterConsentFlagEventCount = await flagEvents.count()

    // identify — profile change may update the flag value, re-recording exposure for the
    // now-identified user
    await page.getByTestId('identify-button').click()
    await expect(page.getByTestId('reset-button')).toBeVisible()

    await expect
      .poll(async () => await flagEvents.count(), {
        message: 'profile updates should emit additional flag view events',
      })
      .toBeGreaterThan(afterConsentFlagEventCount)
  })
})

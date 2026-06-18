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

    await page.getByTestId('identify-button').click()
    await expect(page.getByTestId('reset-button')).toBeVisible()

    await expect(flagEvents).toHaveCount(0)
  })

  // Anonymous users can be in experiments too. Granting consent must record a flag view
  // for the current user — even if they haven't identified yet — so exposure data is
  // complete for experiment analysis regardless of when identity is established.
  test('emits flag view events after consent when already identified', async ({ page }) => {
    const flagEvents = page.locator('[data-testid="event-component-boolean"]')

    await page.getByTestId('identify-button').click()
    await expect(page.getByTestId('reset-button')).toBeVisible()

    await expect(flagEvents).toHaveCount(0)

    await page.getByTestId('consent-button').click()

    await expect
      .poll(async () => await flagEvents.count(), {
        message: 'granting consent after identify should still emit a flag view event',
      })
      .toBeGreaterThan(0)
  })

  // Consent triggers a flag view event for the anonymous user (exposure recorded before
  // identity is known). Identify then updates the profile, which may change the flag value
  // and records a second flag view event for the now-identified user.
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

    await page.getByTestId('identify-button').click()
    await expect(page.getByTestId('reset-button')).toBeVisible()

    await expect
      .poll(async () => await flagEvents.count(), {
        message: 'profile updates should emit additional flag view events',
      })
      .toBeGreaterThan(afterConsentFlagEventCount)
  })
})

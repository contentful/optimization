import { expect, test } from '@playwright/test'

test.describe('navigation page events', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')
  })

  test('emits page events on route navigation', async ({ page }) => {
    const pageEventLocator = page.locator('[data-testid^="event-page-"]')
    await expect(pageEventLocator.first()).toBeVisible()
    const initialPageEventCount = await pageEventLocator.count()

    await page.getByTestId('link-page-two').click()
    await expect(page).toHaveURL(/\/page-two$/)
    await expect(page.getByTestId('page-two-view')).toBeVisible()

    await expect
      .poll(async () => await pageEventLocator.count())
      .toBeGreaterThan(initialPageEventCount)

    const afterPageTwoCount = await pageEventLocator.count()

    await page.getByTestId('link-back-home').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()

    await expect.poll(async () => await pageEventLocator.count()).toBeGreaterThan(afterPageTwoCount)
  })
})

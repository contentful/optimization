import { type Page, expect, test } from '@playwright/test'

async function scrollThroughEntries(page: Page): Promise<void> {
  const entries = page.locator('[data-testid^="content-"]')
  const entryCount = await entries.count()

  for (let index = 0; index < entryCount; index += 1) {
    await entries.nth(index).scrollIntoViewIfNeeded()
  }
}

test.describe('consent gating', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')
  })

  test('allows page events without consent but gates component view events', async ({ page }) => {
    const pageEvents = page.locator('[data-testid^="event-page-"]')
    const componentEvents = page.locator('li').filter({ hasText: 'Component:' })

    await expect(pageEvents.first()).toBeVisible()

    await scrollThroughEntries(page)
    await expect(componentEvents).toHaveCount(0)
  })

  test('emits component view events after consent is accepted', async ({ page }) => {
    const pageEvents = page.locator('[data-testid^="event-page-"]')
    const componentEvents = page.locator('li').filter({ hasText: 'Component:' })

    await expect(pageEvents.first()).toBeVisible()

    await page.getByRole('button', { name: 'Accept Consent' }).click()
    await scrollThroughEntries(page)

    await expect.poll(async () => await componentEvents.count()).toBeGreaterThan(0)
  })
})

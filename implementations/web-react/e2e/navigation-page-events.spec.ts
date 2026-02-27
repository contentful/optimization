import { type Page, expect, test } from '@playwright/test'

async function getRecentPageEventUrls(page: Page): Promise<string[]> {
  const pageEvents = page.locator('[data-testid^="event-page-"]')
  const count = await pageEvents.count()
  const urls: string[] = []

  for (let index = 0; index < count; index += 1) {
    const text = await pageEvents.nth(index).innerText()
    const marker = 'URL: '
    const markerIndex = text.indexOf(marker)
    if (markerIndex === -1) {
      continue
    }

    urls.push(text.slice(markerIndex + marker.length).trim())
  }

  return urls
}

test.describe('navigation page events', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
  })

  test('records ordered route sequence including revisits', async ({ page }) => {
    const pageEventLocator = page.locator('[data-testid^="event-page-"]')
    await expect(pageEventLocator.first()).toBeVisible()
    const initialUrls = await getRecentPageEventUrls(page)
    const initialPageEventCount = initialUrls.length
    await page.getByTestId('link-page-two').click()
    await expect(page).toHaveURL(/\/page-two$/)
    await expect(page.getByTestId('page-two-view')).toBeVisible()

    await expect
      .poll(async () => await pageEventLocator.count())
      .toBeGreaterThan(initialPageEventCount)

    await page.getByTestId('link-back-home').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()

    await page.getByTestId('link-page-two').click()
    await expect(page).toHaveURL(/\/page-two$/)
    await expect(page.getByTestId('page-two-view')).toBeVisible()

    await expect
      .poll(async () => {
        const urls = await getRecentPageEventUrls(page)
        return urls.slice(0, 3)
      })
      .toEqual(['/page-two', '/', '/page-two'])
  })
})

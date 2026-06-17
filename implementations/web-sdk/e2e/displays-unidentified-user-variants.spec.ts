import { expect, test, type Locator, type Page } from '@playwright/test'

function getRenderedEntries(page: Page): Locator {
  return page.locator('#auto-observed, #manually-observed')
}

test.describe('unidentified user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('displays common variants', async ({ page }) => {
    const renderedEntries = getRenderedEntries(page)

    await expect(
      renderedEntries.getByText(
        'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text.',
      ),
    ).toBeVisible()

    await expect(
      renderedEntries.getByText('This is a variant content entry for visitors from Europe.'),
    ).toBeVisible()

    await expect(
      renderedEntries.getByText(
        'This is a variant content entry for visitors using a desktop browser.',
      ),
    ).toBeVisible()
  })

  test('displays unidentified user variants', async ({ page }) => {
    const renderedEntries = getRenderedEntries(page)

    await expect(
      renderedEntries.getByText('This is a level 0 nested baseline entry.'),
    ).toBeVisible()

    await expect(
      renderedEntries.getByText('This is a level 1 nested baseline entry.'),
    ).toBeVisible()

    await expect(
      renderedEntries.getByText('This is a level 2 nested baseline entry.'),
    ).toBeVisible()

    await expect(
      renderedEntries.getByText('This is a variant content entry for new visitors.'),
    ).toBeVisible()

    await expect(
      renderedEntries.getByText('This is a variant content entry for an A/B/C experiment: B'),
    ).toBeVisible()

    await expect(
      renderedEntries.getByText(
        'This is a baseline content entry for all visitors with or without a custom event.',
      ),
    ).toBeVisible()

    await expect(
      renderedEntries.getByText(
        'This is a baseline content entry for all identified or unidentified users.',
      ),
    ).toBeVisible()
  })
})

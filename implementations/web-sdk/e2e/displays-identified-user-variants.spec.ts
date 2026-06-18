import { expect, test, type Locator, type Page } from '@playwright/test'

function getRenderedEntries(page: Page): Locator {
  return page.locator('#auto-observed, #manually-observed')
}

test.describe('identified user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Accept Consent' }).click()
    await expect(page.getByRole('button', { name: 'Reject Consent' })).toBeVisible()

    const identify = page.getByRole('button', { name: 'Identify' })
    await identify.click()
    await expect(page.getByRole('button', { name: 'Reset Profile' })).toBeVisible()

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'Reset Profile' })).toBeVisible()
    await expect(
      page.getByText('This is a variant content entry for identified users.'),
    ).toBeVisible()
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

  test('displays identified user variants', async ({ page }) => {
    const renderedEntries = getRenderedEntries(page)

    await expect(renderedEntries.getByText('This is a level 0 nested variant entry.')).toBeVisible()

    await expect(renderedEntries.getByText('This is a level 1 nested variant entry.')).toBeVisible()

    await expect(renderedEntries.getByText('This is a level 2 nested variant entry.')).toBeVisible()

    await expect(
      renderedEntries.getByText('This is a variant content entry for return visitors.'),
    ).toBeVisible()

    await expect(
      renderedEntries.getByText('This is a variant content entry for an A/B/C experiment: B'),
    ).toBeVisible()

    await expect(
      renderedEntries.getByText(
        'This is a variant content entry for visitors with a custom event.',
      ),
    ).toBeVisible()

    await expect(
      renderedEntries.getByText('This is a variant content entry for identified users.'),
    ).toBeVisible()
  })
})

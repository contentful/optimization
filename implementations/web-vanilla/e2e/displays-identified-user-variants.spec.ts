import { expect, test } from '@playwright/test'

test.describe('identified user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const identify = page.getByRole('button', { name: 'Identify' })
    await identify.click()

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
  })

  test('displays common variants', async ({ page }) => {
    await expect(
      page.getByText(
        'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text.',
      ),
    ).toBeVisible()

    await expect(
      page.getByText('This is a variant content entry for visitors from Europe.'),
    ).toBeVisible()

    await expect(
      page.getByText('This is a variant content entry for visitors using a desktop browser.'),
    ).toBeVisible()
  })

  test('displays identified user variants', async ({ page }) => {
    await expect(
      page.getByText('This is a variant content entry for return visitors.'),
    ).toBeVisible()

    await expect(
      page.getByText('This is a baseline content entry for an A/B/C experiment: A'),
    ).toBeVisible()

    await expect(
      page.getByText('This is a variant content entry for visitors with a custom event.'),
    ).toBeVisible()

    await expect(
      page.getByText('This is a variant content entry for identified users.'),
    ).toBeVisible()
  })
})

import { expect, test } from '@playwright/test'

test.describe('unidentified user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
  })

  test('renders utility panel and entries', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Auto Observed Entries' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Manually Observed Entries' })).toBeVisible()

    await expect(
      page.getByText(
        'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text.',
      ),
    ).toBeVisible()

    await expect(page.getByText('This is a level 0 nested baseline entry.')).toBeVisible()
    await expect(page.getByText('This is a variant content entry for new visitors.')).toBeVisible()
  })
})

import { expect, test } from '@playwright/test'

test.describe('displays common entries and variants', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('displays rich text entry with merge tag', async ({ page }) => {
    await expect(
      page.getByText(
        'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text.',
      ),
    ).toBeVisible()
  })

  test('displays European user variant', async ({ page }) => {
    await expect(
      page.getByText('This is a variant content entry for visitors from Europe.'),
    ).toBeVisible()
  })

  test('displays desktop user variant', async ({ page }) => {
    await expect(
      page.getByText('This is a variant content entry for visitors using a desktop browser.'),
    ).toBeVisible()
  })
})

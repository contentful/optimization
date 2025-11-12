import { expect, test } from '@playwright/test'

test('displays merge tag rich text', async ({ page }) => {
  await page.goto('/')

  await page.waitForLoadState('domcontentloaded')

  await expect(
    page.getByText('This is a baseline content entry for an A/B/C experiment: A'),
  ).toBeVisible()
})

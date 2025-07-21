import { test, expect } from '@playwright/test'

test('displays SDK name', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('WebSDK')).toHaveText('WebSDK')
})

import { expect, test } from '@playwright/test'

test('displays SDK name', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Optimization')).toHaveText('Optimization')
})

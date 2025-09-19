import { expect, test } from '@playwright/test'

test('displays client ID', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('clientId')).toHaveText('whatever')
})

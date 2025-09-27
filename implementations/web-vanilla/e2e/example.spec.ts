import { expect, test } from '@playwright/test'

const OPTIMIZATION_KEY = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'

test('displays client ID', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('optimizationKey')).toHaveText(OPTIMIZATION_KEY)
})

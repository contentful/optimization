import { expect, test } from '@playwright/test'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'

test('displays client ID', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('clientId')).toHaveText(CLIENT_ID)
})

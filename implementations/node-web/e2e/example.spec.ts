import { expect, test } from '@playwright/test'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'

test('responds with the client ID', async ({ request }) => {
  const response = await request.get('/')

  expect(await response.text()).toEqual(CLIENT_ID)
})

test('displays client ID', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('clientId')).toHaveText(CLIENT_ID)
})

import { expect, test } from '@playwright/test'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'

test('test SSR', async ({ request }) => {
  const response = await request.get('http://localhost:3000/')

  expect(await response.json()).toMatchObject({ clientId: CLIENT_ID })
})

test('test CSR', async ({ page }) => {
  await page.goto('http://localhost:4000/')

  await expect(page.getByTestId('clientId')).toHaveText(CLIENT_ID)
})

// test('test Profile ID', async ({ page }) => {
//   await page.goto('http://localhost:4000/')

//   await expect(page.getByTestId('profileId')).toHaveText(CLIENT_ID)
// })

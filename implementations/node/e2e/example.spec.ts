import { expect, test } from '@playwright/test'

const OPTIMIZATION_KEY = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'

test('responds with the client ID', async ({ request }) => {
  const response = await request.get('/')

  expect(await response.text()).toEqual(OPTIMIZATION_KEY)
})

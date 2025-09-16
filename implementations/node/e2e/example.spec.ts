import { expect, test } from '@playwright/test'

test('responds with the client ID', async ({ request }) => {
  const response = await request.get('/')

  expect(await response.text()).toEqual('whatever')
})

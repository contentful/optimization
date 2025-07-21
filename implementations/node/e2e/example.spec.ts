import { test, expect } from '@playwright/test'

test('responds with SDK name', async ({ request }) => {
  const response = await request.get('/')

  expect(await response.text()).toEqual('NodeSDK')
})

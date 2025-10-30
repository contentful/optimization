import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'
import { expect, test } from '@playwright/test'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'
const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'
const URI = 'http://localhost:3000/'

test('SSR/ check client ID', async ({ request }) => {
  const response = await request.get(URI)

  expect(await response.text()).toContain(`"clientId":"${CLIENT_ID}"`)
})

test('SSR/ set Profile id from backend', async ({ context, page }) => {
  await page.goto(URI)

  const state = await context.storageState()

  expect(state.origins[0]?.localStorage).toEqual([{ name: ANONYMOUS_ID, value: 'ssr-profile-id' }])
})

test('SSR/ refresh profile id from backend', async ({ context, page }) => {
  await context.addCookies([
    { name: ANONYMOUS_ID_COOKIE, value: 'old-profile-id', path: '/', domain: 'localhost' },
  ])

  await page.goto(URI)

  const state = await context.storageState()

  expect(state.origins[0]?.localStorage).toEqual([{ name: ANONYMOUS_ID, value: 'ssr-profile-id' }])
})

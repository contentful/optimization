import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'
import { expect, test } from '@playwright/test'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'
const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'
const URI = 'http://localhost:3000/'

const id = '89a085900309de9ecef46965112c309d6f00f1aaed7fcb6709eb851c9557ec42'

test('check client ID rendered from Optimization API on server-side render', async ({
  request,
}) => {
  const response = await request.get(URI)

  expect(await response.text()).toContain(`"clientId":"${CLIENT_ID}"`)
})

test('check client ID rendered from Optimization API on client-side render', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('clientId')).toHaveText(CLIENT_ID)
})

test('set Profile id from backend', async ({ context, page }) => {
  await page.goto(URI)

  const state = await context.storageState()

  expect(state.origins[0]?.localStorage).toEqual([{ name: ANONYMOUS_ID, value: id }])
})

test('backend uses profile id from client', async ({ context, page }) => {
  // const id = 'custom-profile-id'  TODO: fix me

  await context.addCookies([
    { name: ANONYMOUS_ID_COOKIE, value: id, path: '/', domain: 'localhost' },
  ])

  await page.goto(URI)

  const state = await context.storageState()

  expect(state.origins[0]?.localStorage).toEqual([{ name: ANONYMOUS_ID, value: id }])
})

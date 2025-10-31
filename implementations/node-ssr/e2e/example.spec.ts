import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'
import { expect, test } from '@playwright/test'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'
const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'
const URI = 'http://localhost:3000/'

const id = '89a085900309de9ecef46965112c309d6f00f1aaed7fcb6709eb851c9557ec42'

function genAnonymousIdCookie(id: string): {
  name: string
  value: string
  path: string
  domain: string
} {
  return { name: ANONYMOUS_ID_COOKIE, value: id, path: '/', domain: 'localhost' }
}

test('BACKEND: check client ID rendered from Optimization API on server-side render', async ({
  request,
}) => {
  const response = await request.get(URI)

  expect(await response.text()).toContain(`"clientId":"${CLIENT_ID}"`)
})

test('BACKEND: generates new Profile id', async ({ context, page }) => {
  await page.goto(URI)

  const state = await context.storageState()

  expect(state.origins[0]?.localStorage).toEqual([{ name: ANONYMOUS_ID, value: id }])
})

test('BACKEND: identifies profile id from client', async ({ context, page }) => {
  const customIdentifiedId = 'custom-profile-id'
  await context.addCookies([genAnonymousIdCookie(customIdentifiedId)])
  await page.goto(URI)
  const {
    origins: [origin],
  } = await context.storageState()

  expect(origin?.localStorage).toEqual([{ name: ANONYMOUS_ID, value: customIdentifiedId }])
})

test("BACKEND: can't identify profile id from client", async ({ context, page }) => {
  const customUnidentifiedId = 'custom-profile-id'
  await context.addCookies([genAnonymousIdCookie(customUnidentifiedId)])
  await page.goto(URI)
  const {
    origins: [origin],
  } = await context.storageState()

  expect(origin?.localStorage).toEqual([{ name: ANONYMOUS_ID, value: customUnidentifiedId }])
})

test('FRONTEND: check client ID rendered from Optimization API on client-side render', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByTestId('clientId')).toHaveText(CLIENT_ID)
})

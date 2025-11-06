import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'
import { expect, test } from '@playwright/test'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'
const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'

const UID_LENGTH = 36

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
  const response = await request.get('/')

  expect(await response.text()).toContain(`"clientId":"${CLIENT_ID}"`)
})

test('BACKEND: generates new Profile id', async ({ context, page }) => {
  await page.goto('/')

  const state = await context.storageState()

  const storage = state.origins[0]?.localStorage ?? []
  const storedId = storage.find((item) => item.name === ANONYMOUS_ID)?.value

  expect(storedId).toBeDefined()
  expect(storedId).toHaveLength(UID_LENGTH)
})

test('BACKEND: identifies profile id and associates it with user id', async ({ context, page }) => {
  const customIdentifiedId = 'custom-profile-id'
  await context.addCookies([genAnonymousIdCookie(customIdentifiedId)])
  await page.goto(`/user/maximus`)
  const {
    origins: [origin],
  } = await context.storageState()

  expect(origin?.localStorage).toEqual([{ name: ANONYMOUS_ID, value: customIdentifiedId }])
})

test('FRONTEND: check client ID rendered from Optimization API on client-side render', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByTestId('clientId')).toHaveText(CLIENT_ID)
})

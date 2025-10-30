import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'
import { expect, test } from '@playwright/test'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'

const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'

const URI = {
  ssr: 'http://localhost:3000/',
  csr: 'http://localhost:4000/',
}

test('SSR/ check client ID', async ({ request }) => {
  const response = await request.get(URI.ssr)

  expect(await response.text()).toContain(`"clientId":"${CLIENT_ID}"`)
})

test('SSR/ Profile id is stored in local storage if user is logged in', async ({
  context,
  page,
}) => {
  await page.goto(URI.ssr)

  const state = await context.storageState()

  expect(state.origins[0]?.localStorage).toEqual([{ name: ANONYMOUS_ID, value: 'ssr_profile_id' }])
})

test('CSR/ check client ID', async ({ page }) => {
  await page.goto(URI.csr)

  await expect(page.getByTestId('clientId')).toHaveText(CLIENT_ID)
})

test('CSR/ Profile id is stored in local storage if user is logged in', async ({
  page,
  context,
}) => {
  const csrProfileId = 'csr_profile_id'

  await context.addCookies([
    { name: ANONYMOUS_ID_COOKIE, value: csrProfileId, path: '/', domain: 'localhost' },
  ])

  await page.goto(URI.csr)

  const state = await context.storageState()

  expect(state.origins[0]?.localStorage).toEqual([{ name: ANONYMOUS_ID, value: csrProfileId }])
})

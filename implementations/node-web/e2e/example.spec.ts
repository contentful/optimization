import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'
import { ANONYMOUS_ID } from '@contentful/optimization-web'
import { expect, test } from '@playwright/test'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'

const URI = {
  ssr: 'http://localhost:3000/',
  csr: 'http://localhost:4000/',
}

test('test SSR', async ({ request }) => {
  const response = await request.get(URI.ssr)

  expect(await response.json()).toMatchObject({ clientId: CLIENT_ID })
})

test('test CSR', async ({ page }) => {
  await page.goto(URI.csr)

  await expect(page.getByTestId('clientId')).toHaveText(CLIENT_ID)
})

test('profile id is stored in local storage if user is logged in', async ({ page, context }) => {
  const id = '2352jkwefbweuhfb'

  await context.addCookies([
    { name: ANONYMOUS_ID_COOKIE, value: id, path: '/', domain: 'localhost' },
  ])

  await page.goto(URI.csr)

  const state = await context.storageState()

  expect(state.origins[0]?.localStorage).toEqual([{ name: ANONYMOUS_ID, value: id }])
})
